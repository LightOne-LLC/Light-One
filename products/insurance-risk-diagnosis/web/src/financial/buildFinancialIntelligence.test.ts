import { describe, test, expect } from 'vitest';
import { runDiagnosis, emptyDiagnosisInput } from '../calc';
import type { DiagnosisInput } from '../types/diagnosis';
import { buildDiagnosisExplanation } from '../rag';
import { buildFinancialProfile } from './buildFinancialProfile';
import { buildFinancialSnapshot } from './buildFinancialSnapshot';
import { buildFinancialIntelligence } from './buildFinancialIntelligence';

function snapshotFor(overrides: (input: DiagnosisInput) => void, id: string, createdAt: string) {
  const input = emptyDiagnosisInput();
  overrides(input);
  const result = runDiagnosis(input);
  return { input, result, snapshot: buildFinancialSnapshot({ id, createdAt, input, result }) };
}

describe('buildFinancialIntelligence', () => {
  test('決定論的である(同じ入力なら同じ出力)', () => {
    const { input, result, snapshot } = snapshotFor(() => {}, 'a', '2026-02-01');
    const profile = buildFinancialProfile(input, result);
    const evidence = buildDiagnosisExplanation(result);

    const first = buildFinancialIntelligence(profile, result, [snapshot], evidence);
    const second = buildFinancialIntelligence(profile, result, [snapshot], evidence);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('history/profile/diagnosis/evidenceを一切変更しない', () => {
    const { input, result, snapshot } = snapshotFor(() => {}, 'a', '2026-02-01');
    const profile = buildFinancialProfile(input, result);
    const evidence = buildDiagnosisExplanation(result);
    const history = [snapshot];

    const beforeProfile = JSON.stringify(profile);
    const beforeResult = JSON.stringify(result);
    const beforeHistory = JSON.stringify(history);
    const beforeEvidence = JSON.stringify(evidence);

    buildFinancialIntelligence(profile, result, history, evidence);

    expect(JSON.stringify(profile)).toBe(beforeProfile);
    expect(JSON.stringify(result)).toBe(beforeResult);
    expect(JSON.stringify(history)).toBe(beforeHistory);
    expect(JSON.stringify(evidence)).toBe(beforeEvidence);
  });

  test('historyが1件のみの場合、keyChangesは空配列になる(比較対象が無いため)', () => {
    const { input, result, snapshot } = snapshotFor(() => {}, 'a', '2026-02-01');
    const profile = buildFinancialProfile(input, result);
    const evidence = buildDiagnosisExplanation(result);

    const intelligence = buildFinancialIntelligence(profile, result, [snapshot], evidence);
    expect(intelligence.keyChanges).toEqual([]);
  });

  test('historyが2件以上ある場合、keyChangesはcompareSnapshotsと同じ結果になる(最新と直前を比較)', () => {
    const previous = snapshotFor((i) => { i.asset.savings = 100; }, 'a', '2026-01-01').snapshot;
    const { input, result, snapshot: current } = snapshotFor((i) => { i.asset.savings = 500; }, 'b', '2026-02-01');
    const profile = buildFinancialProfile(input, result);
    const evidence = buildDiagnosisExplanation(result);

    const intelligence = buildFinancialIntelligence(profile, result, [current, previous], evidence);
    expect(intelligence.keyChanges.length).toBeGreaterThan(0);
    const savingsChange = intelligence.keyChanges.find((c) => c.key === 'savings')!;
    expect(savingsChange.previous).toBe(100);
    expect(savingsChange.current).toBe(500);
  });

  test('missingInformationはprofileから見つかった項目と一致する', () => {
    const { input, result } = snapshotFor((i) => { i.basic.monthlyLivingExpense = undefined; }, 'a', '2026-02-01');
    const profile = buildFinancialProfile(input, result);
    const evidence = buildDiagnosisExplanation(result);
    const intelligence = buildFinancialIntelligence(profile, result, [], evidence);
    expect(intelligence.missingInformation.some((m) => m.key === 'monthlyLivingExpense')).toBe(true);
  });

  test('evidenceは引数で渡したStructuredExplanationをそのまま保持する(ここで新しい根拠を生成しない)', () => {
    const { input, result } = snapshotFor(() => {}, 'a', '2026-02-01');
    const profile = buildFinancialProfile(input, result);
    const evidence = buildDiagnosisExplanation(result);
    const intelligence = buildFinancialIntelligence(profile, result, [], evidence);
    expect(intelligence.evidence).toBe(evidence);
  });

  test('riskAreasはDiagnosisResult.categoriesから上位3件をそのまま参照する(再判定しない)', () => {
    const { input, result } = snapshotFor(() => {}, 'a', '2026-02-01');
    const profile = buildFinancialProfile(input, result);
    const evidence = buildDiagnosisExplanation(result);
    const intelligence = buildFinancialIntelligence(profile, result, [], evidence);

    const expectedTop3 = result.categories.slice().sort((a, b) => b.score - a.score).slice(0, 3);
    expect(intelligence.riskAreas.map((c) => c.key)).toEqual(expectedTop3.map((c) => c.key));
    for (const area of intelligence.riskAreas) {
      const original = result.categories.find((c) => c.key === area.key)!;
      expect(area).toBe(original);
    }
  });
});

describe('Critical invariant: Phase 3/4 does not change DiagnosisResult', () => {
  test('financialモジュールの主要APIをすべて呼び出しても、同じ入力に対するrunDiagnosisの出力は変わらない', () => {
    const input = emptyDiagnosisInput();

    const before = runDiagnosis(input);
    const profile = buildFinancialProfile(input, before);
    const snapshot = buildFinancialSnapshot({ id: 'x', createdAt: 'now', input, result: before });
    const evidence = buildDiagnosisExplanation(before);
    buildFinancialIntelligence(profile, before, [snapshot], evidence);
    const after = runDiagnosis(input);

    // calculatedAtはnew Date().toISOString()による実時刻のため、呼び出しタイミングで
    // 数ミリ秒差が生じるのは既存calc enginesの仕様通りの挙動であり、不変性の対象外とする。
    expect({ ...after, calculatedAt: null }).toEqual({ ...before, calculatedAt: null });
    expect(after.overallScore).toBe(before.overallScore);
    expect(after.deathCoverage.requiredAmount).toBe(before.deathCoverage.requiredAmount);
    expect(after.categories.map((c) => c.score)).toEqual(before.categories.map((c) => c.score));
    expect(after.categories.map((c) => c.level)).toEqual(before.categories.map((c) => c.level));
    expect(after.categories.map((c) => c.reasons)).toEqual(before.categories.map((c) => c.reasons));
  });
});
