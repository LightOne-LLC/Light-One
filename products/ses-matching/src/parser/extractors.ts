// メール本文からのフィールド抽出ヘルパー。すべて決定論的な文字列処理のみで、
// 抽出できない場合はundefinedを返す(値を推測して埋めない)。
//
// 実際のSES案件・要員メールの観察に基づき、以下の形式に対応する:
//   - 「ラベル：値」(コロン区切り、改行区切り) — 既存
//   - 「【ラベル】値」(全角カッコ区切り、コロンなし。次の【まで、または末尾まで
//     が値。HTML由来で本文が改行なしの1行に潰れているケースでも動作する) — 追加
//   - ラベル内に全角スペースが混じる表記("場 所" 等)の吸収 — 追加
//   - 「■ラベル 値」(■のみの見出し、閉じカッコ無し。BP要員紹介メールの
//     「■スキル」等で使われる。次の■または末尾までが値) — 追加
//   - 「・ラベル：値」(箇条書きの「・」で始まるコロン形式。BP要員紹介メールの
//     「・単金（税抜）：」等で使われる。ラベル自体に全角カッコの注釈が
//     含まれる場合も、その注釈込みでラベルの一部として扱う。実メールでは
//     HTML由来で本文全体が1行に潰れ、複数の「・ラベル：値」が空白区切りで
//     並ぶため、次の「・」または「■」または末尾までを値とする) — 追加
//   - 「■ラベル■値」(■で開閉された見出し。株式会社キャリアビート形式の
//     案件メールの「■期間■」「■場所■」等で使われる。次の■または末尾まで
//     が値) — 追加

import type { DateValue, EngineerSkill, JapaneseLevel, RequiredSkill } from '../scoring/types';

const SPLIT_PATTERN = /[、,・/]/;

/** ラベル文字列を比較用に正規化する(内部の空白を除去)。"場 所"と"場所"を同一視するため。 */
function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 「ラベル: 値」「ラベル：値」形式を行単位で探す(既存形式)。 */
function extractColonValue(body: string, labels: string[]): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    for (const label of labels) {
      const match = line.match(new RegExp(`^\\s*${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`));
      if (match) return match[1].trim();
    }
  }
  return undefined;
}

/** 「【ラベル】値」形式を本文全体から探す(次の【または末尾までが値)。
 * 改行の有無に関わらず動作する。ラベル名は内部の空白を無視して比較する。 */
function extractBracketValue(body: string, labels: string[]): string | undefined {
  const normalizedTargets = labels.map(normalizeLabel);
  const re = /【\s*([^】]{1,20})\s*】([\s\S]*?)(?=【|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (normalizedTargets.includes(normalizeLabel(match[1]))) {
      const value = match[2].replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return undefined;
}

/** 「■ラベル 値」形式(■のみで閉じカッコが無い見出し)を本文全体から探す。
 * 次の■または末尾までが値。BP要員紹介メールで観察された
 * "■スキル\n値"(改行区切り)と、HTML由来で1行に潰れた
 * "■スキル 値 ■次の見出し"の両方に対応する。 */
function extractSectionValue(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = body.match(new RegExp(`■\\s*${escapeRegExp(label)}\\s*([\\s\\S]*?)(?=■|$)`));
    if (match) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return undefined;
}

/** 「・ラベル：値」形式(箇条書きの「・」で始まるコロン形式)を本文全体から
 * 探す。BP要員紹介メールで観察された「・単金（税抜）：100万円 ・希望：…」
 * のように、HTML由来で本文全体が1行に潰れ複数の「・ラベル：値」が空白
 * 区切りで並ぶケースに対応するため、行単位ではなく本文全体から次の
 * 「・」または「■」または末尾までを値とする。 */
function extractBulletColonValue(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = body.match(new RegExp(`・\\s*${escapeRegExp(label)}\\s*[:：]\\s*([^・■]*)`));
    if (match) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return undefined;
}

/** 「■ラベル■値」形式(■で開閉された見出し)を本文全体から探す。次の■または
 * 末尾までが値。株式会社キャリアビート形式の案件メールで観察された
 * "■期間■\n2026年10月 ~ 2027年3月"等に対応する。単独の■(閉じ側が無い
 * extractSectionValue)と区別するため、ラベル直後に必ず■を要求する。 */
function extractDoubleMarkerSectionValue(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = body.match(new RegExp(`■\\s*${escapeRegExp(label)}\\s*■\\s*([\\s\\S]*?)(?=■|$)`));
    if (match) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return undefined;
}

/** 本文中から「ラベル: 値」「【ラベル】値」「■ラベル 値」「■ラベル■値」
 * 「・ラベル：値」の値部分を探す。コロン形式 → 【】形式 → ■見出し形式(片側)
 * → ■見出し形式(両側) → ・箇条書き形式の順に試す(既存挙動を維持しつつ、
 * より新しい/緩い形式は最後に試すことで誤検出のリスクを下げる)。 */
export function extractLabeledValue(body: string, labels: string[]): string | undefined {
  return (
    extractColonValue(body, labels) ??
    extractBracketValue(body, labels) ??
    extractSectionValue(body, labels) ??
    extractDoubleMarkerSectionValue(body, labels) ??
    extractBulletColonValue(body, labels)
  );
}

/** 単価表記から{min,max}(万円)を取り出す。
 *
 * 対応するのは以下の、実メールで確認された明示的なパターンのみ:
 *   - "68〜80万円" "68万円〜80万円" "65万～75万"(全角チルダ)のような範囲区切り
 *   - "73万(Min68万)" のように下限が明示されている場合
 *   - 数値が1つだけの場合(例: "80万円" "76万(応相談)") — 固定値としてmin=maxとする
 *   - "550,000円/月" のようなカンマ区切りの円表記(1万円単位へ換算)
 *
 * "〜65万円"のように上限のみが書かれ下限が不明な場合は、下限を捏造しないため
 * 抽出しない("固定"の記載がある場合を除く — 例: "〜80万円（固定）"は単一の
 * 確定値とみなせるため対応する)。2つの数値があってもその関係が範囲区切りや
 * Min指定で明示されていなければレンジとして採用しない。
 */
export function parseRateRange(value: string): { min: number; max: number } | undefined {
  const normalized = value.replace(/,/g, '').trim();
  const allNumbers = normalized.match(/\d+(?:\.\d+)?/g) ?? [];

  const minLabelMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万\s*[（(]\s*Min\s*(\d+(?:\.\d+)?)\s*万/i);
  if (minLabelMatch) {
    const max = Number(minLabelMatch[1]);
    const min = Number(minLabelMatch[2]);
    return min <= max ? { min, max } : undefined;
  }

  const isFixed = /固定/.test(normalized);
  const startsOpenEnded = /^[〜～~\-−]/.test(normalized);

  if (allNumbers.length === 1) {
    if (startsOpenEnded && !isFixed) return undefined; // 下限不明の"〜X万"は捏造しない
    const num = Number(allNumbers[0]);
    const converted = !/万/.test(normalized) && num >= 1000 ? num / 10000 : num;
    return { min: converted, max: converted };
  }

  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万?円?\s*[〜～~\-−]\s*(\d+(?:\.\d+)?)\s*万円?/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return min <= max ? { min, max } : undefined;
  }

  return undefined;
}

/** サブジェクト等、ラベルの無い自由文中から単価を探す(件名フォールバック用)。
 * ケース番号等の無関係な数値を誤って単価と判定しないよう、"万"が数値に
 * 隣接している場合のみ採用する(ラベル文脈が無いため、より保守的にする)。 */
export function findRateInFreeText(text: string): { min: number; max: number } | undefined {
  const normalized = text.replace(/,/g, '');
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万?\s*円?\s*[〜～~\-−]\s*(\d+(?:\.\d+)?)\s*万円?/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return min <= max ? { min, max } : undefined;
  }
  const singleMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万円?/);
  if (singleMatch) {
    const num = Number(singleMatch[1]);
    return { min: num, max: num };
  }
  return undefined;
}

const IMMEDIATE_PATTERN = /即日/;
// "8月or9月"のように複数の月にまたがる曖昧な表記。どちらか一方に決め打ち
// しない(根拠のない日付補完を避ける)ため、この表記が含まれる場合は
// unknown(月精度にも解決できない)として扱う。
const AMBIGUOUS_MULTI_MONTH_PATTERN = /\d{1,2}月\s*(?:or|または|、|,|\/)\s*\d{1,2}月/;

/**
 * メール本文中の稼働時期表記からDateValueを取り出す。
 *
 * 対応する形式(実メールで確認済みのもののみ):
 *   - "2026-04-01"(そのまま) / "2026年4月1日" → day precision
 *   - "2026-10"(そのまま) / "2026年10月"(日が無い) → month precision
 *   - "即日" → immediate(相対表現。具体的な暦日へは変換しない —
 *     現在時刻に依存させないため)
 *   - "8月or9月"のように複数月にまたがる曖昧な表記、"10月"のように年が
 *     無く年を特定できない表記 → unknown(日付らしい記載はあったが、
 *     根拠なく1つに絞り込まない)
 *
 * 上記のいずれにも該当しない(日付らしい記載が全く無い)場合はundefinedを
 * 返す — その場合、呼び出し側はフィールド自体を候補に含めない
 * (「記載はあったが不明」なunknownと、「そもそも記載が無い」を区別するため)。
 */
export function parseDateValue(value: string): DateValue | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { precision: 'day', value };

  const dayMatch = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (dayMatch) {
    const [, y, m, d] = dayMatch;
    return { precision: 'day', value: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` };
  }

  if (IMMEDIATE_PATTERN.test(value)) return { precision: 'immediate', value: '' };

  if (AMBIGUOUS_MULTI_MONTH_PATTERN.test(value)) return { precision: 'unknown', value: '' };

  if (/^\d{4}-\d{2}$/.test(value)) return { precision: 'month', value };

  const monthMatch = value.match(/(\d{4})年(\d{1,2})月/);
  if (monthMatch) {
    const [, y, m] = monthMatch;
    return { precision: 'month', value: `${y}-${m.padStart(2, '0')}` };
  }

  // 年が無い"10月〜"等は、年を推測しないためunknown扱いとする。
  if (/\d{1,2}月/.test(value)) return { precision: 'unknown', value: '' };

  return undefined;
}

const EXPERIENCE_RE = /^(.+?)[(（]\s*(?:約\s*)?(\d+(?:\.\d+)?)\s*(年|ヶ月|か月|カ月)/;

/** "Java(3年以上)" "JavaScript(70ヶ月)" のような経験年数付きスキル表記から
 * 名前と年数を取り出す。ヶ月/か月/カ月表記は年に換算する(小数第2位まで)。
 * 経験年数の記載が無ければ years は undefined を返す(推測しない)。 */
function parseNameAndExperience(token: string): { name: string; years: number | undefined } {
  const match = token.match(EXPERIENCE_RE);
  if (!match) return { name: token, years: undefined };
  const num = Number(match[2]);
  const years = match[3] === '年' ? num : Math.round((num / 12) * 100) / 100;
  return { name: match[1].trim(), years };
}

/** 一部の要員票で見られる先頭の"言語：" "言語:" 見出しを取り除く
 * (スキル名の一部ではなく、リストの見出しに過ぎないため)。 */
function stripSkillListHeading(value: string): string {
  return value.replace(/^言語[:：]\s*/, '');
}

/** "Java(3年以上)" "AWS" のようなカンマ区切りのスキル列挙を案件側の
 * RequiredSkill[]へ変換する。年数の記載が無いスキルはminYears: 0
 * (「明示的な下限なし」を表す、推測ではない)。 */
export function parseRequiredSkillList(value: string, required: boolean): RequiredSkill[] {
  return splitList(stripSkillListHeading(value)).map((token) => {
    const { name, years } = parseNameAndExperience(token);
    return { name, minYears: years ?? 0, required };
  });
}

/** 要員側のスキル列挙("Java(5年)、JavaScript(70ヶ月)")をEngineerSkill[]へ変換する。 */
export function parseEngineerSkillList(value: string): EngineerSkill[] {
  return splitList(stripSkillListHeading(value)).map((token) => {
    const { name, years } = parseNameAndExperience(token);
    return { name, years: years ?? 0 };
  });
}

/** "東京都、大阪府" のような勤務地列挙をstring[]へ変換する。 */
export function parseLocationList(value: string): string[] {
  return splitList(value);
}

function splitList(value: string): string[] {
  return value
    .split(SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/** リモート関連の強いキーワード(誤判定しにくいもの)。 */
const STRONG_REMOTE_POSITIVE = /フルリモート|リモートメイン|基本リモート|テレワーク/;
const STRONG_REMOTE_NEGATIVE = /リモート不可|フル出社|出社必須/;

/** "可"/"あり"/"希望" -> true, "不可"/"なし" -> false。判別できなければundefined。
 * "地方不可"のように"リモート"と無関係な"不可"に引きずられないよう、
 * まずリモート専用の強いキーワードを優先的に判定する。 */
export function parseYesNo(value: string): boolean | undefined {
  if (STRONG_REMOTE_POSITIVE.test(value)) return true;
  if (STRONG_REMOTE_NEGATIVE.test(value)) return false;
  if (/不可|なし|不要/.test(value)) return false;
  if (/可|あり|希望|OK/i.test(value)) return true;
  return undefined;
}

/** ラベルの無い自由文(件名や、既に抽出済みの勤務地文字列等)からリモート可否を
 * 判定する。誤判定を避けるため、強いキーワードのみで判定し、それ以外はundefined。 */
export function findRemoteInFreeText(text: string): boolean | undefined {
  if (STRONG_REMOTE_POSITIVE.test(text)) return true;
  if (STRONG_REMOTE_NEGATIVE.test(text)) return false;
  return undefined;
}

const JAPANESE_LEVEL_PATTERNS: [RegExp, JapaneseLevel][] = [
  [/ネイティブ/, 'native'],
  [/ビジネス/, 'business'],
  [/N1/, 'N1'],
  [/N2/, 'N2'],
  [/N3/, 'N3'],
  [/N4/, 'N4'],
  [/不問|なし|不要/, 'none'],
];

/** "ビジネスレベル" 等の表記をJapaneseLevelへ正規化する。判別できなければundefined。 */
export function parseJapaneseLevel(value: string): JapaneseLevel | undefined {
  for (const [pattern, level] of JAPANESE_LEVEL_PATTERNS) {
    if (pattern.test(value)) return level;
  }
  return undefined;
}
