import { PUBLIC_SYSTEM_ASOF } from '../calc';
import type { DiagnosisInput, DiagnosisResult } from '../types/diagnosis';
import { buildFinancialProfile } from './buildFinancialProfile';
import { FINANCIAL_PROFILE_VERSION } from './types';
import type { FinancialSnapshot } from './types';

/**
 * 保存済みの1診断記録(id/createdAt/input/result)からFinancialSnapshotを組み立てる。
 * localStorageの既存スキーマ(StoredDiagnosis)は一切変更しない — この関数は
 * 読み取り時に既存データから導出するだけで、新しい永続化フォーマットを追加しない。
 */
export function buildFinancialSnapshot(
  record: { id: string; createdAt: string; input: DiagnosisInput; result: DiagnosisResult },
): FinancialSnapshot {
  return {
    id: record.id,
    createdAt: record.createdAt,
    diagnosis: record.result,
    profile: buildFinancialProfile(record.input, record.result),
    version: {
      diagnosis: PUBLIC_SYSTEM_ASOF,
      profile: FINANCIAL_PROFILE_VERSION,
    },
  };
}
