import { describe, test, expect } from 'vitest';
import { runDiagnosis, emptyDiagnosisInput, PUBLIC_SYSTEM_ASOF } from '../calc';
import { buildFinancialSnapshot } from './buildFinancialSnapshot';
import { FINANCIAL_PROFILE_VERSION } from './types';

describe('buildFinancialSnapshot', () => {
  test('id/createdAtをそのまま保持し、diagnosisは既存DiagnosisResultをそのまま格納する(再計算しない)', () => {
    const input = emptyDiagnosisInput();
    const result = runDiagnosis(input);
    const snapshot = buildFinancialSnapshot({ id: 'abc-123', createdAt: '2026-09-24T00:00:00.000Z', input, result });

    expect(snapshot.id).toBe('abc-123');
    expect(snapshot.createdAt).toBe('2026-09-24T00:00:00.000Z');
    expect(snapshot.diagnosis).toBe(result);
  });

  test('versionは診断エンジンの制度時点とprofileスキーマバージョンを保持する', () => {
    const input = emptyDiagnosisInput();
    const result = runDiagnosis(input);
    const snapshot = buildFinancialSnapshot({ id: 'x', createdAt: 'now', input, result });

    expect(snapshot.version.diagnosis).toBe(PUBLIC_SYSTEM_ASOF);
    expect(snapshot.version.profile).toBe(FINANCIAL_PROFILE_VERSION);
  });

  test('serializationしても情報が失われない(JSON round-trip)', () => {
    const input = emptyDiagnosisInput();
    const result = runDiagnosis(input);
    const snapshot = buildFinancialSnapshot({ id: 'x', createdAt: 'now', input, result });

    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    expect(roundTripped).toEqual(snapshot);
  });

  test('壊れた/不完全なrecordを渡しても例外の種類が明確である(存在しないフィールドで静かに壊れない)', () => {
    // @ts-expect-error 意図的に不完全なDiagnosisResultを渡す
    expect(() => buildFinancialSnapshot({ id: 'x', createdAt: 'now', input: emptyDiagnosisInput(), result: {} })).toThrow();
  });
});
