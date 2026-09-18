import { describe, test, expect, beforeEach } from 'vitest';
import { runDiagnosis, listDiagnosisHistory, getDiagnosisDetail, deleteDiagnosisHistory } from './diagnosisStore';
import type { DiagnosisInput } from '../types/diagnosis';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

(globalThis as any).localStorage = new MemoryStorage();

function sampleInput(): DiagnosisInput {
  return {
    basic: {
      age: 35,
      gender: 'male',
      occupationType: 'employee',
      occupationRisk: 'low',
      annualIncome: 600,
      hasSpouse: false,
      children: [],
      educationCourse: 'all_public',
    },
    asset: { savings: 200, otherAssets: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0 },
    existingInsurance: { deathCoverage: 0, hasMedicalCoverage: false, hasDisabilityCoverage: false, hasSavingsTypeCoverage: false },
    health: { hasMedicalHistory: false },
  };
}

describe('diagnosisStore', () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  test('runDiagnosis後、listDiagnosisHistoryとgetDiagnosisDetailで取得できる', async () => {
    const { id } = await runDiagnosis(sampleInput());

    const list = await listDiagnosisHistory();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);

    const detail = await getDiagnosisDetail(id);
    expect(detail.id).toBe(id);
  });

  test('deleteDiagnosisHistoryで削除した履歴は一覧・詳細から消える', async () => {
    const { id } = await runDiagnosis(sampleInput());
    await deleteDiagnosisHistory(id);

    const list = await listDiagnosisHistory();
    expect(list).toHaveLength(0);
    await expect(getDiagnosisDetail(id)).rejects.toThrow('診断結果が見つかりません。');
  });

  test('存在しないIDを削除してもエラーにならず、他の履歴は残る', async () => {
    const { id } = await runDiagnosis(sampleInput());
    await expect(deleteDiagnosisHistory('not-a-real-id')).resolves.toBeUndefined();

    const list = await listDiagnosisHistory();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
  });
});
