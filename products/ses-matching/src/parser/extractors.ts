// メール本文からのフィールド抽出ヘルパー。すべて決定論的な文字列処理のみで、
// 抽出できない場合はundefinedを返す(値を推測して埋めない)。

import type { EngineerSkill, JapaneseLevel, RequiredSkill } from '../scoring/types';

const SPLIT_PATTERN = /[、,・/]/;

/** 本文中から「ラベル: 値」または「ラベル：値」の行を探し、値部分を返す。 */
export function extractLabeledValue(body: string, labels: string[]): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    for (const label of labels) {
      const match = line.match(new RegExp(`^\\s*${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`));
      if (match) return match[1].trim();
    }
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "60万円〜80万円" "60〜80万円" "70万円" などから min/max(万円)を取り出す。 */
export function parseRateRange(value: string): { min: number; max: number } | undefined {
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length >= 2) return { min: numbers[0], max: numbers[1] };
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return undefined;
}

/** "2026-04-01"(そのまま) または "2026年4月1日" を YYYY-MM-DD に正規化する。
 * どちらの形にも合わなければ undefined(推測しない)。 */
export function parseDateJa(value: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
}

/** "Java(3年以上)" "AWS" のようなカンマ区切りのスキル列挙を案件側の
 * RequiredSkill[]へ変換する。年数の記載が無いスキルはminYears: 0
 * (「明示的な下限なし」を表す、推測ではない)。 */
export function parseRequiredSkillList(value: string, required: boolean): RequiredSkill[] {
  return splitList(value).map((token) => {
    const match = token.match(/^(.+?)[(（]\s*(\d+(?:\.\d+)?)\s*年/);
    if (match) return { name: match[1].trim(), minYears: Number(match[2]), required };
    return { name: token, minYears: 0, required };
  });
}

/** 要員側のスキル列挙("Java(5年), AWS(2年)")をEngineerSkill[]へ変換する。 */
export function parseEngineerSkillList(value: string): EngineerSkill[] {
  return splitList(value).map((token) => {
    const match = token.match(/^(.+?)[(（]\s*(\d+(?:\.\d+)?)\s*年/);
    if (match) return { name: match[1].trim(), years: Number(match[2]) };
    return { name: token, years: 0 };
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

/** "可"/"あり"/"希望" -> true, "不可"/"なし" -> false。判別できなければundefined。
 * "不可"が"可"を含んでしまうため、否定語を先にチェックする。 */
export function parseYesNo(value: string): boolean | undefined {
  if (/不可|なし|不要/.test(value)) return false;
  if (/可|あり|希望|OK/i.test(value)) return true;
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
