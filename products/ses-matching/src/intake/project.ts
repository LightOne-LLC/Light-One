import type { ProjectInput } from '../scoring/types';
import type { ProjectRecord, ValidationResult } from './types';
import {
  isJapaneseLevel,
  isNonEmptyString,
  isNonNegativeNumber,
  isValidDateString,
  validateRequiredSkill,
} from './validationHelpers';

/**
 * 外部から受け取った案件データを検証する。
 * 必須項目の存在・型・明らかに不正な値（負数の単価、単価レンジの逆転、不正な日付等）のみを見る。
 */
export function validateProjectRecord(input: unknown): ValidationResult<ProjectRecord> {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['ProjectRecordはオブジェクトである必要があります'] };
  }
  const record = input as Record<string, unknown>;

  if (!isNonEmptyString(record.id)) {
    errors.push('id: 空でない文字列である必要があります');
  }

  if (!Array.isArray(record.requiredSkills)) {
    errors.push('requiredSkills: 配列である必要があります');
  } else {
    record.requiredSkills.forEach((skill, i) => validateRequiredSkill(skill, `requiredSkills[${i}]`, errors));
  }

  if (!isNonNegativeNumber(record.rateMin)) {
    errors.push('rateMin: 0以上の数値である必要があります');
  }
  if (!isNonNegativeNumber(record.rateMax)) {
    errors.push('rateMax: 0以上の数値である必要があります');
  }
  if (
    isNonNegativeNumber(record.rateMin) &&
    isNonNegativeNumber(record.rateMax) &&
    record.rateMin > record.rateMax
  ) {
    errors.push('rateMin: rateMaxを超えることはできません');
  }

  if (!isNonEmptyString(record.location)) {
    errors.push('location: 空でない文字列である必要があります');
  }

  if (typeof record.remoteAllowed !== 'boolean') {
    errors.push('remoteAllowed: 真偽値である必要があります');
  }

  if (!isValidDateString(record.startDate)) {
    errors.push('startDate: YYYY-MM-DD形式の有効な日付である必要があります');
  }

  if (!isJapaneseLevel(record.japaneseLevel)) {
    errors.push('japaneseLevel: 有効な日本語レベルである必要があります');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value: record as unknown as ProjectRecord };
}

/** 検証済みのProjectRecordをScoring Engineが受け取るProjectInputへ変換する（idを取り除くのみ）。 */
export function toProjectInput(record: ProjectRecord): ProjectInput {
  return {
    requiredSkills: record.requiredSkills,
    rateMin: record.rateMin,
    rateMax: record.rateMax,
    location: record.location,
    remoteAllowed: record.remoteAllowed,
    startDate: record.startDate,
    japaneseLevel: record.japaneseLevel,
  };
}
