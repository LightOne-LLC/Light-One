import type { ProjectInput } from '../scoring/types';
import type { ProjectRecord, ValidationResult } from './types';
import {
  isAcceptableDateValue,
  isJapaneseLevel,
  isNonEmptyString,
  isNonNegativeNumber,
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

  // day('YYYY-MM-DD')/month('YYYY-MM')/immediate(即日)は有効な稼働時期情報
  // として受け入れる。unknown(記載はあったが解決できない)は引き続きFAILとし、
  // 根拠なくPASS条件を緩めない(日付を推測して埋めない)。
  if (!isAcceptableDateValue(record.startDate)) {
    errors.push('startDate: 有効な稼働時期情報(day/month/immediateのいずれか)である必要があります');
  }

  // 任意項目: 未指定(undefined)は許容する。値がある場合のみ形式を検査する
  // (実メールでは日本語レベルが記載されないことが大半なため)。
  if (record.japaneseLevel !== undefined && !isJapaneseLevel(record.japaneseLevel)) {
    errors.push('japaneseLevel: 有効な日本語レベルである必要があります');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value: record as unknown as ProjectRecord };
}

/** 検証済みのProjectRecordをScoring Engineが受け取るProjectInputへ変換する
 * （idを取り除き、japaneseLevel未指定は'none'へ正規化する）。 */
export function toProjectInput(record: ProjectRecord): ProjectInput {
  return {
    requiredSkills: record.requiredSkills,
    rateMin: record.rateMin,
    rateMax: record.rateMax,
    location: record.location,
    remoteAllowed: record.remoteAllowed,
    startDate: record.startDate,
    japaneseLevel: record.japaneseLevel ?? 'none',
  };
}
