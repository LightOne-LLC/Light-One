import type { DatePrecision, DateValue, EngineerSkill, JapaneseLevel, RequiredSkill } from '../scoring/types';

const JAPANESE_LEVELS: JapaneseLevel[] = ['none', 'N4', 'N3', 'N2', 'N1', 'business', 'native'];
const DATE_PRECISIONS: DatePrecision[] = ['day', 'month', 'immediate', 'unknown'];

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

function isValidMonthString(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** DateValueとして構造的に正しいか(precisionと値の組み合わせが矛盾していないか)
 * だけを見る。「有効な稼働時期情報として十分か」の判定(unknownを拒否する等)
 * はこの関数の責務ではなく、呼び出し側(validateProjectRecord/
 * validateEngineerRecord)が行う — 構造的な妥当性と、業務上の受け入れ可否は
 * 別の関心事のため。 */
export function isDateValue(value: unknown): value is DateValue {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.precision !== 'string' || !(DATE_PRECISIONS as string[]).includes(candidate.precision)) {
    return false;
  }
  if (typeof candidate.value !== 'string') return false;

  switch (candidate.precision as DatePrecision) {
    case 'day':
      return isValidDateString(candidate.value);
    case 'month':
      return isValidMonthString(candidate.value);
    case 'immediate':
    case 'unknown':
      return candidate.value === '';
    default:
      return false;
  }
}

/** Validation上、実際に稼働時期の情報として受け入れられる精度かどうか。
 * 'unknown'(記載はあったが解決できなかった)は、勝手にPASS条件を緩めない
 * ため引き続き不十分な情報として扱う。'immediate'(即日)は具体的な暦日を
 * 持たないが、それ自体が明確で actionable な情報のためPASS対象に含める。 */
export function isAcceptableDateValue(value: unknown): value is DateValue {
  return isDateValue(value) && value.precision !== 'unknown';
}

export function isJapaneseLevel(value: unknown): value is JapaneseLevel {
  return typeof value === 'string' && (JAPANESE_LEVELS as string[]).includes(value);
}

export function validateRequiredSkill(value: unknown, path: string, errors: string[]): value is RequiredSkill {
  if (typeof value !== 'object' || value === null) {
    errors.push(`${path}: オブジェクトである必要があります`);
    return false;
  }
  const skill = value as Record<string, unknown>;
  let ok = true;
  if (!isNonEmptyString(skill.name)) {
    errors.push(`${path}.name: 空でない文字列である必要があります`);
    ok = false;
  }
  if (!isNonNegativeNumber(skill.minYears)) {
    errors.push(`${path}.minYears: 0以上の数値である必要があります`);
    ok = false;
  }
  if (typeof skill.required !== 'boolean') {
    errors.push(`${path}.required: 真偽値である必要があります`);
    ok = false;
  }
  return ok;
}

export function validateEngineerSkill(value: unknown, path: string, errors: string[]): value is EngineerSkill {
  if (typeof value !== 'object' || value === null) {
    errors.push(`${path}: オブジェクトである必要があります`);
    return false;
  }
  const skill = value as Record<string, unknown>;
  let ok = true;
  if (!isNonEmptyString(skill.name)) {
    errors.push(`${path}.name: 空でない文字列である必要があります`);
    ok = false;
  }
  if (!isNonNegativeNumber(skill.years)) {
    errors.push(`${path}.years: 0以上の数値である必要があります`);
    ok = false;
  }
  return ok;
}
