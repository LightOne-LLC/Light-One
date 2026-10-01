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

/** 「【ラベル】値」形式を本文全体から探す(次の【、次の■見出し、または
 * 末尾までが値)。改行の有無に関わらず動作する。ラベル名は内部の空白を
 * 無視して比較する。同一メール内で【】見出しと■見出しが混在する実データ
 * (例:「【尚可スキル】...■条件...」)で、■を境界として認識しないと
 * 後続の無関係なフィールドや署名ブロックまで値に取り込んでしまう不具合が
 * 見つかったため、■もセクション境界として扱う。ただし「【スキル】■必須
 * ...■尚可...」のように■必須/■尚可/■歓迎がそのセクション自身の内部
 * 構造(extractNestedSkillSectionsが解釈する)として使われる実データも
 * あるため、これらは境界とみなさない(除外しないと必須/尚可の内容が
 * スキル値へ入る前に切り捨てられてしまう)。 */
function extractBracketValue(body: string, labels: string[]): string | undefined {
  const normalizedTargets = labels.map(normalizeLabel);
  const re = /【\s*([^】]{1,20})\s*】([\s\S]*?)(?=【|■(?!\s*(?:必須|尚可|歓迎))|$)/g;
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
 * 次の■、次の【】見出し、または末尾までが値。BP要員紹介メールで観察された
 * "■スキル\n値"(改行区切り)と、HTML由来で1行に潰れた
 * "■スキル 値 ■次の見出し"の両方に対応する。■見出しの後に【】見出しが続く
 * 実データ(extractBracketValueと逆方向の混在パターン)で、■のみを境界と
 * すると後続の無関係なフィールドや署名まで値に取り込んでしまうため、
 * 【もセクション境界として扱う。 */
function extractSectionValue(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = body.match(new RegExp(`■\\s*${escapeRegExp(label)}\\s*([\\s\\S]*?)(?=■|【|$)`));
    if (match) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return undefined;
}

// 「・」以外にも「◆必須スキル：...◆尚可スキル：...◆勤務地：...」のように
// 同一メール内で全フィールドが「◆」で箇条書きされる実データが見つかった。
// ただしこの種のテンプレートでは、値自体が「・Azureの...経験 ・Azure環境の
// ...経験」のように「・」で複数項目に分かれて続くため、「・」を単純に
// 禁止文字へ含めると1項目目で値が途切れてしまう。そのため、開始記号が
// 「・」自身の場合のみ「・」も値の終端とみなし、開始記号が「◆」の場合は
// 「・」を値の一部として許容する。
//
// 開始記号(BULLET_MARKERS、この関数がラベル自体を検出しに行く対象)には、
// 実データで確証の取れた「◆」のみを追加する。「□」「■」開始のラベルは、
// 複数行の箇条書き継続や「尚可：」等のサブラベル分離を伴う、より複雑な
// 実データ形式(extractLabeledBulletBlockが専用に対応する)でも使われて
// おり、ここに含めるとより丁寧な処理を素通りしてしまう不具合が実データ
// 検証で見つかったため、追加しない。
//
// 一方、値の終端(STOP_MARKER_SRC)には「□■★▼●」も含める — BP要員紹介
// メールの「■基本情報\n・最寄駅：渋谷駅\n■希望条件\n...」のように、
// 「・」始まりの値が次の「■」見出しの手前で終わることを要求する既存の
// 実データ形式があるため(開始記号としては使わないが、終端記号としては
// 必要)。
const BULLET_MARKERS = ['・', '◆'];
const STOP_MARKER_SRC = '□■◆★▼●';

/** 「・ラベル：値」形式(箇条書きの「・」等で始まるコロン形式)を本文全体から
 * 探す。BP要員紹介メールで観察された「・単金（税抜）：100万円 ・希望：…」
 * のように、HTML由来で本文全体が1行に潰れ複数の「・ラベル：値」が空白
 * 区切りで並ぶケースに対応するため、行単位ではなく本文全体から次の
 * 箇条書き記号または末尾までを値とする。 */
function extractBulletColonValue(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    for (const marker of BULLET_MARKERS) {
      const stopSet = marker === '・' ? `・${STOP_MARKER_SRC}` : STOP_MARKER_SRC;
      const match = body.match(
        new RegExp(`${escapeRegExp(marker)}\\s*${escapeRegExp(label)}\\s*[:：]\\s*([^${stopSet}]*)`),
      );
      if (match) {
        const value = match[1].replace(/\s+/g, ' ').trim();
        if (value) return value;
      }
    }
  }
  return undefined;
}

/** 「・ラベル値」形式(コロン省略、ラベル直後に数字が続く)を本文全体から
 * 探す。BP要員紹介メールの一部で「・単金（税抜）85万円」のようにコロンが
 * 省略される表記が観測されたため対応する。コロンが無い分、通常の助詞等を
 * 値として誤って取り込まないよう、ラベル直後(空白を挟んでもよい)が数字の
 * 場合のみ値とみなす、より保守的な条件にする。extractLabeledValueの
 * 共通チェーンには入れず、数値系フィールド(単価等)の呼び出し側で
 * 明示的にフォールバックとして使う。 */
export function extractBulletValueNoColonNumeric(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = body.match(new RegExp(`・\\s*${escapeRegExp(label)}\\s*(?=\\d)([^・■]*)`));
    if (match) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return undefined;
}

/** 「※」以降の補足注記を切り落とす。BP要員紹介メールの一部で
 * "■最寄り駅 浜松町 駅 ※リモート希望（週1~4日出社可）"のように、
 * 見出しの値本体に直接※注記が続けて書かれる(別の■見出しに分かれていない)
 * ケースが観測されたため、勤務地等の値として注記まで丸ごと取り込まない
 * ようにする。※が無ければ元の文字列をそのまま返す。 */
export function stripNoteSuffix(value: string): string {
  const index = value.indexOf('※');
  return index === -1 ? value : value.slice(0, index).trim();
}

/** 「■ラベル■値」形式(■で開閉された見出し)を本文全体から探す。次の■、
 * 次の【】見出し、または末尾までが値。株式会社キャリアビート形式の案件
 * メールで観察された"■期間■\n2026年10月 ~ 2027年3月"等に対応する。
 * 単独の■(閉じ側が無いextractSectionValue)と区別するため、ラベル直後に
 * 必ず■を要求する。extractSectionValueと同様、■見出しの後に【】見出しが
 * 続く実データで無関係な値まで取り込まないよう、【もセクション境界とする。 */
function extractDoubleMarkerSectionValue(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = body.match(new RegExp(`■\\s*${escapeRegExp(label)}\\s*■\\s*([\\s\\S]*?)(?=■|【|$)`));
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

  // 「70～max90万」のように、範囲の上限数値の直前に装飾的な"max"表記が
  // 挟まる実データ(Astro案件テンプレート等)が見つかった。これを認識
  // できないと数値が2つあるのに範囲とみなせず、単価が丸ごと未取得になる
  // (以前は件名フォールバックが上限のみを固定値として拾ってしまい、
  // 本来の下限を隠して"90万固定"のように誤解させていたため、これも修正)。
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万?円?\s*[〜～~\-−]\s*(?:[Mm][Aa][Xx]\s*)?(\d+(?:\.\d+)?)\s*万円?/);
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
  const rangeMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*万?\s*円?\s*[〜～~\-−]\s*(?:[Mm][Aa][Xx]\s*)?(\d+(?:\.\d+)?)\s*万円?/,
  );
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

// "即日"(今日から/ASAP)と"随時"(いつでも/都度応相談)は表現こそ違うが、
// どちらも具体的な暦日を持たない・特定の日付制約を課さないという点で同じ
// 意味を持つ(実際のキャリアビート形式の案件メールで観測)。どちらも
// immediateとして扱い、現在時刻には一切依存させない(具体的な暦日への
// 変換はしない)。
const IMMEDIATE_PATTERN = /即日|随時/;
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
 *   - "即日" / "随時" → immediate(相対表現。具体的な暦日へは変換しない —
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

// 実メール(500件規模)の調査で、「必須」「尚可」を示すサブ見出しの表記が
// <<必須>>/【必須】だけでなく、~必須~(チルダ)・■必須(単独の■、閉じ無し)・
// 「必須スキル：」「必須要件：」「必須：」(コロン形式、歓迎側は
// 「歓迎スキル：」「歓迎：」「尚可スキル：」「尚可要件：」「尚可：」)でも
// 使われることを確認した。1つの正規表現に一般化し、個別の表記ごとに
// 専用関数を増やさない。
const REQUIRED_MARKER_SRC = '<<\\s*必須\\s*>>|【\\s*必須\\s*】|~\\s*必須\\s*~|■\\s*必須\\s*■?|必須(?:スキル|要件)?\\s*[:：]';
const PREFERRED_MARKER_SRC =
  '<<\\s*尚可\\s*>>|【\\s*尚可\\s*】|~\\s*尚可\\s*~|■\\s*尚可\\s*■?|尚可(?:スキル|要件)?\\s*[:：]|歓迎(?:スキル)?\\s*[:：]';

/** 「<<必須>>」「【必須】」「~必須~」「■必須」「必須スキル：」等のサブ見出しで
 * 必須/尚可が分かれた「■スキル■」セクション内から、それぞれの生テキストを
 * 取り出す。株式会社キャリアビート形式・その他複数のBP会社の案件メールで
 * 観察された表記ゆれを1つの一般化した境界検出でまとめて扱う(次のいずれか
 * のマーカー、または末尾までが値)。extractLabeledValueが既に本文の空白を
 * 1つずつのスペースへ正規化した後の値を受け取る前提。 */
export function extractNestedSkillSections(skillSectionValue: string): { required?: string; preferred?: string } {
  const markers: { isRequired: boolean; start: number; end: number }[] = [];
  const requiredRe = new RegExp(REQUIRED_MARKER_SRC, 'g');
  const preferredRe = new RegExp(PREFERRED_MARKER_SRC, 'g');
  let m: RegExpExecArray | null;
  while ((m = requiredRe.exec(skillSectionValue)) !== null) {
    markers.push({ isRequired: true, start: m.index, end: m.index + m[0].length });
  }
  while ((m = preferredRe.exec(skillSectionValue)) !== null) {
    markers.push({ isRequired: false, start: m.index, end: m.index + m[0].length });
  }
  markers.sort((a, b) => a.start - b.start);

  let required: string | undefined;
  let preferred: string | undefined;
  for (let i = 0; i < markers.length; i++) {
    const nextStart = markers[i + 1]?.start ?? skillSectionValue.length;
    const value = skillSectionValue.slice(markers[i].end, nextStart).trim();
    if (!value) continue;
    if (markers[i].isRequired) required ??= value;
    else preferred ??= value;
  }
  return { required, preferred };
}

/** 「・」始まりの箇条書き(1行1要件)を、行内の中点(例:"法令・規格対応")と
 * 区別して分割する。extractLabeledValueの時点で改行は既に1つのスペースへ
 * 正規化されているため、「・」が空白(元は改行)の直後にある場合のみ
 * 項目区切りとみなし、語句内部の「・」(直前が空白でない)は区切らない。
 * 通常のparseRequiredSkillList/splitListが想定する「Java、AWS」のような
 * 短いカンマ区切り列挙とは異なり、各要件が長い自然文であることが多い
 * ため専用の分割ロジックを用いる。 */
function splitBulletRequirementLines(value: string): string[] {
  return value
    .split(/(?:^|\s)・/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** 「■スキル■」内の「<<必須>>」「<<尚可>>」から取り出した箇条書きの要件文
 * (自然文であることが多く、"Java(3年以上)"のような短い技術名の列挙とは
 * 限らない)を、そのまま案件側のRequiredSkill[]へ変換する。経験年数の
 * 明示的な抽出はしない(自然文からの年数推測になり得るため)。 */
export function parseNestedRequirementList(value: string, required: boolean): RequiredSkill[] {
  return splitBulletRequirementLines(value).map((name) => ({ name, minYears: 0, required }));
}

// 実メール(500件規模)の調査で、「(数字)/□/■/◆/★/▼/●等)ラベル：」という
// 見出し行の直後に、「・」または「•」で始まる箇条書きが複数行続く形式が
// 多数確認された(例: "2)必須スキル：\n•	AWS...\n•	IT..."、
// "□スキル：※注記\n　・Java...\n　尚可：\n　・Vue.js...")。見出し行自体は
// 既存のextractColonValueが前提とする「行頭からラベル」に一致しない
// (数字・記号のプレフィックスがあるため)うえ、値が複数行にまたがるため、
// 既存のextractLabeledValueチェーンでは取得できなかった。この専用関数で
// 対応する(必須スキル等、精度が重要なフィールドの追加フォールバックとして
// のみ使う想定)。
// 改行を含まない空白(半角/全角スペース・タブ)だけを指す文字クラス。
// 通常の\sは\nも含んでしまい、全角スペースだけの空行を挟んだ次の見出し行
// (例:「尚可：」)まで意図せず連結してしまう不具合が実データ検証で見つかった
// ため、行内の空白と改行を明確に区別する。
const HSPACE = ' \\t　';
const LIST_MARKER_PREFIX_SRC = `(?:\\d+[)）]|[□■◆★▼●])?[${HSPACE}]*`;
// 次の見出しが存在しない場合、抽出範囲が本文末尾の署名ブロック(社名・氏名・
// メールアドレス)まで無制限に伸びてしまう不具合が実データ検証で見つかった。
// 行単位の判定だけでは、HTMLの改行崩れで署名がスキル箇条書きと同じ行/
// 「・」始まりの行に連結されてしまう実データ(例:
// 「・APIのテスト...商流：貴社プロパーまで...株式会社ヘルスベイシス
// ...E-mail：kakimi@h-basis.co.jp...」のような1行化された本文)を
// 見逃すため、行の内訳に関わらずブロック全体からメールアドレスらしき
// 文字列/法人格表記が最初に現れる位置で強制的に切り詰める。
const SIGNATURE_LEGAL_MARK_RE = /(株式会社|（株）|\(株\)|㈱|有限会社|合同会社)/;
const EMAIL_LIKE_RE = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/;
// 単価/勤務地/商流等、既に案件側で個別フィールドとして扱っている別ラベルが
// 改行崩れによりスキル箇条書きと同じ行へ連結され、無関係な値が
// requiredSkillsへ混入する実データが見つかった。既存の各フィールド抽出で
// 使っているラベル語彙をそのまま流用し、これらが現れた位置で打ち切る
// (新しい推測ルールを追加するのではなく、既知のラベル一致のみに限定する)。
const OTHER_FIELD_LABELS = [
  '単価',
  '金額',
  '契約金額',
  '単金',
  '勤務地',
  '作業場所',
  '商流',
  '☆商流',
  '期間',
  '契約',
  '面談',
  '勤務時間',
  '勤務',
  '外国籍',
  '人数',
  '稼働開始',
  '開始日',
  '作業期間',
  'リモート',
  '通勤',
  '出社',
  '日本語レベル',
];
const OTHER_FIELD_BOUNDARY_RE = new RegExp(`(?:${OTHER_FIELD_LABELS.map(escapeRegExp).join('|')})[${HSPACE}]*[:：]`);

// マッチ位置そのものではなく、その行(または、extractBracketValue等が
// 既に改行をスペースへ正規化済みの値の場合は直前の区切りスペース)まで
// 遡って切り詰める。マッチ位置そのもので切ると「サクシード株式会社」の
// うち「サクシード」部分のような社名の断片が末尾に残ってしまう
// (実データで確認)ため、行/セグメント全体を除外する。
function cutBeforeLine(text: string, index: number): string {
  const boundary = Math.max(text.lastIndexOf('\n', index), text.lastIndexOf(' ', index));
  return text.slice(0, boundary + 1).trim();
}

export function truncateAtSignature(text: string): string {
  const emailIndex = text.match(EMAIL_LIKE_RE)?.index;
  const legalIndex = text.match(SIGNATURE_LEGAL_MARK_RE)?.index;
  const candidates = [emailIndex, legalIndex].filter((i): i is number => typeof i === 'number');
  if (candidates.length === 0) return text;
  return cutBeforeLine(text, Math.min(...candidates));
}

export function truncateAtOtherFieldLabel(text: string): string {
  const index = text.match(OTHER_FIELD_BOUNDARY_RE)?.index;
  if (index === undefined) return text;
  return cutBeforeLine(text, index);
}

/** 「(数字)/□等)ラベル：」見出し行の直後に複数行続く箇条書きを1つの値として
 * 集める。見出し行自体にある「※」注記(記入方法の案内文であり要件そのもの
 * ではない)はstripNoteSuffixと同じ考え方で除外する。subLabelsを指定すると、
 * ブロック内でそのサブラベル(「尚可：」等)が現れた行から後を別の値として
 * 分離して返す(必須/尚可の混在防止)。次の見出し行(同じプレフィックス
 * パターン)、空行、または本文末尾までを対象範囲とする。会社名と断定
 * できる根拠が無ければ推測しないのと同じ考え方で、該当が無ければ
 * undefinedを返す。 */
export function extractLabeledBulletBlock(
  body: string,
  labels: string[],
  subLabels: string[] = [],
): { main?: string; sub?: string } {
  for (const label of labels) {
    const headingRe = new RegExp(`^${LIST_MARKER_PREFIX_SRC}${escapeRegExp(label)}[${HSPACE}]*[:：]?[${HSPACE}]*(.*)$`, 'm');
    const heading = headingRe.exec(body);
    if (!heading) continue;

    const sameLine = stripNoteSuffix(heading[1]).trim();
    const afterIndex = heading.index + heading[0].length;
    const rest = body.slice(afterIndex);
    // 空行(全角スペースのみの見た目上の空行を含む)は区切りとして扱わない
    // — 実データで、尚可等のサブラベルの直前にこのような行が挟まる
    // ケースが確認された。次の見出し行、または本文末尾までを対象とする。
    // ただしsubLabels(「尚可：」等)自体はブロック内部の要素であり、次の
    // 見出しとして扱ってはならない — 除外しないと尚可行の手前でブロックが
    // 途切れ、尚可以降の内容がsubへ分離される前に失われてしまう。
    const subLabelExclusion =
      subLabels.length > 0 ? `(?!(?:${subLabels.map(escapeRegExp).join('|')})[${HSPACE}]*[:：])` : '';
    const boundary = rest.match(
      new RegExp(`\\n${LIST_MARKER_PREFIX_SRC}${subLabelExclusion}[^${HSPACE}・•\\n]{1,12}[${HSPACE}]*[:：]`),
    );
    const rawBlock = (sameLine + '\n' + (boundary ? rest.slice(0, boundary.index) : rest)).trim();
    // 次の見出しが検出できず、かつ本文がHTML由来で改行が失われている場合、
    // ここまでの範囲に署名(社名・氏名・メールアドレス)がそのまま連結されて
    // 残ってしまう。行単位の区切りに関わらず、その手前で強制的に切り詰める。
    const block = truncateAtOtherFieldLabel(truncateAtSignature(rawBlock));
    if (!block) continue;

    let mainText = block;
    let subText: string | undefined;
    if (subLabels.length > 0) {
      const subRe = new RegExp(
        `\\n?${LIST_MARKER_PREFIX_SRC}(?:${subLabels.map(escapeRegExp).join('|')})[${HSPACE}]*[:：]?[${HSPACE}]*`,
      );
      const subMatch = mainText.match(subRe);
      if (subMatch?.index !== undefined) {
        subText = mainText.slice(subMatch.index + subMatch[0].length).trim();
        mainText = mainText.slice(0, subMatch.index).trim();
      }
    }

    // 各行先頭の箇条書き記号("・"/"•")を取り除いてから" ・ "で結合し直す
    // (元の記号を残したまま区切り記号を追加すると二重に付いてしまうため)。
    const normalize = (s: string) =>
      s
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^[•・]\s*/, ''))
        .filter((line) => line.length > 0)
        .join(' ・ ')
        .trim();
    const main = normalize(mainText);
    const sub = subText ? normalize(subText) : undefined;
    if (main || sub) return { main: main || undefined, sub };
  }
  return {};
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

/** リモート関連の強いキーワード(誤判定しにくいもの)。「リモート希望」は
 * 実メール(単独■見出し形式で最寄駅の値に直接注記される等)で観察された、
 * 「出社可能」「常駐可能」のような曖昧語とは異なり明確にリモートを希望する
 * という意思を示す語のため、強いキーワードとして扱って問題ない。「在宅」も
 * 同様に、日本のSES業界で在宅勤務(テレワーク)を指す一般的な語であり、
 * 「テレワーク」と同程度に曖昧さが無いため追加する。 */
const STRONG_REMOTE_POSITIVE = /フルリモート|リモートメイン|基本リモート|テレワーク|リモート希望|在宅/;
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

// 表示名として不自然に長い値(ラベル抽出の巻き込み失敗や、営業担当者名・
// 電話番号まで含む長い件名を件名フォールバックとして採用してしまうケース)
// を、根拠なく受け入れないための上限。実メールで観測された適切な案件名/
// 氏名ラベルの値は全て十分短く(概ね30文字程度まで)、この上限を超えない。
const MAX_DISPLAY_NAME_LENGTH = 50;

/** ラベル抽出結果(または件名)を、案件名/氏名として表示するための後処理。
 * 前後の空白と、抽出時に稀に巻き込まれる余分なコロン(ラベルの二重表記等に
 * よるもの)のみを取り除く。括弧類は"（C#/ASP.NET）"や"【新規案件】"のように
 * 案件名・件名の正当な一部として現れるため、意図的に取り除かない
 * (一律に取り除くと内容を壊す実例を確認済み)。空になった場合や長すぎる
 * 場合(件名フォールバックで営業担当者名・電話番号まで含んでしまうケース等、
 * 根拠のない値)はundefinedを返して呼び出し側にIDフォールバックさせる。 */
export function sanitizeDisplayName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .trim()
    .replace(/^[:：]+\s*/, '')
    .replace(/\s*[:：]+$/, '')
    .trim();
  if (!cleaned) return undefined;
  if (cleaned.length > MAX_DISPLAY_NAME_LENGTH) return undefined;
  return cleaned;
}

// 実メール(200件規模)の調査で、要員メールの「氏名：」の値そのものに
// "S.F（男性）"のようにイニシャル+性別が直接続けて記載される形式が
// 60件中26件で確認された。性別は今回のUI表示に不要な属性(タスク要件)の
// ため、氏名の末尾からこの記載のみを取り除く。名前の途中や案件名に現れる
// 一般的な括弧(技術注記等)は対象にしない、末尾の性別表記に限定した
// パターンのみを対象にする。
const TRAILING_GENDER_ANNOTATION = /[\s　]*[（(](?:男性|女性)[)）]\s*$/;

/** 氏名の末尾に直接続く性別表記("（男性）"等)のみを取り除く。該当が無ければ
 * そのまま返す(氏名内部の他の括弧は一切変更しない)。 */
export function stripTrailingGenderAnnotation(value: string): string {
  return value.replace(TRAILING_GENDER_ANNOTATION, '').trim();
}

// 実メール(200件規模、案件メール83件)の調査で、「会社名：」のような単一の
// 明示ラベルは存在しなかった一方、「(株式会社|㈱|有限会社等)の◯◯です/と
// 申します/でございます」という定型的な自己紹介文が82/83件で確認された
// (日本のビジネスメールにおける標準的な名乗りの慣習)。まずこの自己紹介文
// パターンを最優先で使い、無ければ本文中で最初に現れる会社名らしきトークン
// (単独の署名行等)にフォールバックする。どちらも無ければ会社名を推測して
// 生成しない(undefinedのまま)。
const COMPANY_MARK = '(?:株式会社|㈱|（株）|\\(株\\)|有限会社)';
// 英字の社名(例: "Innovations株式会社")が10〜15文字を超えることがあるため、
// 前後の文字数上限は実メールで観測された範囲より十分大きく取る
// (空白・句読点で自然に区切られるため、長すぎる自由文を巻き込む心配はない)。
const GREETING_COMPANY_RE = new RegExp(
  `([^\\s　、。]{0,25}${COMPANY_MARK}[^\\s　、。]{0,25})の[^\\n、。]{1,20}(?:です|と申します|でございます)`,
);
const PLAIN_COMPANY_RE = new RegExp(`([^\\s　、。:：・]{0,25}${COMPANY_MARK}[^\\s　、。:：・]{0,25})`, 'g');

// 案件メールでは、本文冒頭が「[メールボックス所有会社]　ご担当者　様」
// 「[同左]御中」のような、送信元ではなく受信者(メールボックス所有会社)
// 自身への宛名で始まる実データが確認された(project id 1a0b2a2596931e9d:
// 「株式会社Light One\nご担当者　様\n\nNBWの王　敬東でございます。」
// のように、本当の送信元(NBW)は法人格表記を伴わない自己紹介文で名乗って
// おり、GREETING_COMPANY_REには一致しない)。単純に「本文中で最初に現れる
// 法人格表記」を送信元と断定すると、この宛名部分を誤って送信元会社と
// 判定してしまう。本文冒頭の会社名だけで送信元と判断してはならないため、
// 法人格表記の直後(至近距離)に「様」「御中」「ご担当者」等の宛名の敬称が
// 続く場合は受信者への宛名とみなして候補から除外し、次の法人格表記を探す。
const RECIPIENT_SALUTATION_RE = /(様|御中|ご担当者)/;
const RECIPIENT_SALUTATION_WINDOW = 20;

/** 本文から会社名を抽出する(自己紹介文 > 単独の会社名らしき記載の優先順位)。
 * どちらのパターンにも一致しなければundefinedを返し、呼び出し側で
 * 「未記載」表示に委ねる(会社名を推測して生成しない)。 */
export function extractCompanyName(body: string): string | undefined {
  const greeting = body.match(GREETING_COMPANY_RE);
  if (greeting) return greeting[1];

  const plainRe = new RegExp(PLAIN_COMPANY_RE);
  let match: RegExpExecArray | null;
  while ((match = plainRe.exec(body)) !== null) {
    const matchEnd = match.index + match[0].length;
    const after = body.slice(matchEnd, matchEnd + RECIPIENT_SALUTATION_WINDOW);
    if (RECIPIENT_SALUTATION_RE.test(after)) continue;
    return match[1];
  }
  return undefined;
}

// 実メール(要員メール134件、500件取得規模)の調査で、「所属：」の値の
// 98%以上が「弊社個人事業主」「弊社フリーランス」「弊社プロパー」の
// ような契約形態(商流)の記述であり、会社名ではなかった(「弊社」は
// 送信元BPエージェント自身を指す一人称であり、要員本人でも要員の所属先
// でもない)。要員本人の所属先を明示する専用ラベルは1件も確認できな
// かった。
//
// 「その要員情報を送信してきた会社名」(companyName)は、「所属」欄とは
// 完全に独立して、本文冒頭の名乗り(自己紹介文)からのみ抽出する。
// extractCompanyName()の単独会社名フォールバック(PLAIN_COMPANY_RE)は
// 要員メールには使わない — 実メール調査で、本文中に複数の法人格表記が
// 存在し(返信の引用ヘッダ等に混入した自社(受信者側)の会社名を含む
// ケースも確認)、単純な最初の一致では送信元を誤認するリスクが実証され
// たため。自己紹介文が見つからない場合はcompanyNameを推測せずundefined
// のままにする。
export function extractGreetingCompanyName(body: string): string | undefined {
  const greeting = body.match(GREETING_COMPANY_RE);
  return greeting ? greeting[1] : undefined;
}

// 名乗り(自己紹介文)が見つからない場合の第2の手がかりとして、署名ブロック
// (会社名の近くにTEL/Mobile/Email/HP等の連絡先ラベルが伴う箇所)を使う。
// 実メール調査で、返信の引用ヘッダ等に混入した無関係な会社名(受信者
// 自身の会社名を含む)は、本文中の他の連絡先ラベルから離れた位置(数百〜
// 2000文字以上)に単独で現れる一方、実際の送信元の署名は近傍(実測で
// 184文字)に連絡先ラベルを伴うことを確認した。HTML由来で改行が失われ
// 1行化した本文にも対応するため、行単位ではなく文字数の近さで判定する。
// この距離の閾値(300文字)を超える場合は、署名として断定できる根拠が
// 無いため会社名を推測しない(undefinedのまま)。
const SIGNATURE_CONTACT_LABEL_RE = /(TEL|Tel|tel|Mobile|Email|E-mail|HP|FAX|Fax|URL)[:：]/;
const SIGNATURE_PROXIMITY_WINDOW = 300;

export function extractSignatureCompanyName(body: string): string | undefined {
  const companyRe = new RegExp(`\\S*${COMPANY_MARK}\\S*`, 'g');
  let best: { value: string; distance: number } | undefined;
  let match: RegExpExecArray | null;
  while ((match = companyRe.exec(body)) !== null) {
    const matchEnd = match.index + match[0].length;
    const before = body.slice(Math.max(0, match.index - SIGNATURE_PROXIMITY_WINDOW), match.index);
    const after = body.slice(matchEnd, matchEnd + SIGNATURE_PROXIMITY_WINDOW);

    let distance: number | undefined;
    const afterLabel = SIGNATURE_CONTACT_LABEL_RE.exec(after);
    if (afterLabel) distance = afterLabel.index;
    const beforeLabel = SIGNATURE_CONTACT_LABEL_RE.exec(before);
    if (beforeLabel) {
      const beforeDistance = before.length - beforeLabel.index - beforeLabel[0].length;
      if (distance === undefined || beforeDistance < distance) distance = beforeDistance;
    }
    if (distance === undefined) continue;

    if (!best || distance < best.distance) {
      best = { value: match[0], distance };
    }
  }
  return best ? sanitizeDisplayName(best.value) : undefined;
}
