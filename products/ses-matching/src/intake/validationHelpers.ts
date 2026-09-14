import type { EngineerSkill, JapaneseLevel, RequiredSkill } from '../scoring/types';

const JAPANESE_LEVELS: JapaneseLevel[] = ['none', 'N4', 'N3', 'N2', 'N1', 'business', 'native'];

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
