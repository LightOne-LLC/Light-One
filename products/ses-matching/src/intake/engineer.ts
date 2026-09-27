import type { EngineerInput } from '../scoring/types';
import type { EngineerRecord, ValidationResult } from './types';
import {
  isJapaneseLevel,
  isNonEmptyString,
  isNonNegativeNumber,
  isValidDateString,
  validateEngineerSkill,
} from './validationHelpers';

/**
 * 外部から受け取った要員データを検証する。
 * 必須項目の存在・型・明らかに不正な値（負数の単価、単価レンジの逆転、不正な日付等）のみを見る。
 */
export function validateEngineerRecord(input: unknown): ValidationResult<EngineerRecord> {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['EngineerRecordはオブジェクトである必要があります'] };
  }
  const record = input as Record<string, unknown>;

  if (!isNonEmptyString(record.id)) {
    errors.push('id: 空でない文字列である必要があります');
  }

  if (!Array.isArray(record.skills)) {
    errors.push('skills: 配列である必要があります');
  } else {
    record.skills.forEach((skill, i) => validateEngineerSkill(skill, `skills[${i}]`, errors));
  }

  if (!isNonNegativeNumber(record.desiredRateMin)) {
    errors.push('desiredRateMin: 0以上の数値である必要があります');
  }
  if (!isNonNegativeNumber(record.desiredRateMax)) {
    errors.push('desiredRateMax: 0以上の数値である必要があります');
  }
  if (
    isNonNegativeNumber(record.desiredRateMin) &&
    isNonNegativeNumber(record.desiredRateMax) &&
    record.desiredRateMin > record.desiredRateMax
  ) {
    errors.push('desiredRateMin: desiredRateMaxを超えることはできません');
  }

  if (!Array.isArray(record.desiredLocations) || !record.desiredLocations.every(isNonEmptyString)) {
    errors.push('desiredLocations: 空でない文字列の配列である必要があります');
  }

  if (typeof record.remoteDesired !== 'boolean') {
    errors.push('remoteDesired: 真偽値である必要があります');
  }

  if (!isValidDateString(record.availableFrom)) {
    errors.push('availableFrom: YYYY-MM-DD形式の有効な日付である必要があります');
  }

  if (!isJapaneseLevel(record.japaneseLevel)) {
    errors.push('japaneseLevel: 有効な日本語レベルである必要があります');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value: record as unknown as EngineerRecord };
}

/** 検証済みのEngineerRecordをScoring Engineが受け取るEngineerInputへ変換する（idを取り除くのみ）。 */
export function toEngineerInput(record: EngineerRecord): EngineerInput {
  return {
    skills: record.skills,
    desiredRateMin: record.desiredRateMin,
    desiredRateMax: record.desiredRateMax,
    desiredLocations: record.desiredLocations,
    remoteDesired: record.remoteDesired,
    availableFrom: record.availableFrom,
    japaneseLevel: record.japaneseLevel,
  };
}
