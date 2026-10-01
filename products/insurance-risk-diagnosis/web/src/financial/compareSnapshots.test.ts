import { describe, test, expect } from 'vitest';
import { runDiagnosis, emptyDiagnosisInput } from '../calc';
import type { DiagnosisInput } from '../types/diagnosis';
import { buildFinancialSnapshot } from './buildFinancialSnapshot';
import { compareSnapshots } from './compareSnapshots';

function snapshotFor(overrides: (input: DiagnosisInput) => void, id: string, createdAt: string) {
  const input = emptyDiagnosisInput();
  overrides(input);
  const result = runDiagnosis(input);
  return buildFinancialSnapshot({ id, createdAt, input, result });
}

describe('compareSnapshots', () => {
  test('overallScoreの変化をincreased/decreasedとして検出する', () => {
    const previous = snapshotFor((i) => { i.asset.savings = 50; }, 'a', '2026-01-01');
    const current = snapshotFor((i) => { i.asset.savings = 500; }, 'b', '2026-02-01');
    const changes = compareSnapshots(previous, current);
    const overall = changes.find((c) => c.key === 'overallScore')!;
    expect(overall.previous).toBe(previous.diagnosis.overallScore);
    expect(overall.current).toBe(current.diagnosis.overallScore);
    expect(['increased', 'decreased', 'unchanged']).toContain(overall.direction);
  });

  test('貯蓄額が増えた場合はincreasedになる', () => {
    const previous = snapshotFor((i) => { i.asset.savings = 100; }, 'a', '2026-01-01');
    const current = snapshotFor((i) => { i.asset.savings = 600; }, 'b', '2026-02-01');
    const change = compareSnapshots(previous, current).find((c) => c.key === 'savings')!;
    expect(change.previous).toBe(100);
    expect(change.current).toBe(600);
    expect(change.direction).toBe('increased');
  });

  test('値が同じ場合はunchangedになる', () => {
    const previous = snapshotFor(() => {}, 'a', '2026-01-01');
    const current = snapshotFor(() => {}, 'b', '2026-02-01');
    const change = compareSnapshots(previous, current).find((c) => c.key === 'savings')!;
    expect(change.direction).toBe('unchanged');
  });

  test('片方がundefined(未入力)の場合はchangedとして扱い、nullとして返す(捏造しない)', () => {
    const previous = snapshotFor((i) => { i.basic.hasSpouse = true; i.basic.spouseAnnualIncome = undefined; }, 'a', '2026-01-01');
    const current = snapshotFor((i) => { i.basic.hasSpouse = true; i.basic.spouseAnnualIncome = 300; }, 'b', '2026-02-01');
    const change = compareSnapshots(previous, current).find((c) => c.key === 'spouseAnnualIncome')!;
    expect(change.previous).toBeNull();
    expect(change.current).toBe(300);
    expect(change.direction).toBe('changed');
  });

  test('両方ともundefined(未入力)の場合はunchangedになる', () => {
    const previous = snapshotFor((i) => { i.basic.monthlyLivingExpense = undefined; }, 'a', '2026-01-01');
    const current = snapshotFor((i) => { i.basic.monthlyLivingExpense = undefined; }, 'b', '2026-02-01');
    const change = compareSnapshots(previous, current).find((c) => c.key === 'monthlyLivingExpense')!;
    expect(change.previous).toBeNull();
    expect(change.current).toBeNull();
    expect(change.direction).toBe('unchanged');
  });

  test('7領域すべてのカテゴリスコア変化を含む', () => {
    const previous = snapshotFor(() => {}, 'a', '2026-01-01');
    const current = snapshotFor(() => {}, 'b', '2026-02-01');
    const changes = compareSnapshots(previous, current);
    for (const key of ['death', 'medical', 'disability', 'retirement', 'care', 'asset', 'inheritance']) {
      expect(changes.some((c) => c.key === `category:${key}`)).toBe(true);
    }
  });

  test('previous/currentのSnapshotを変更しない', () => {
    const previous = snapshotFor((i) => { i.asset.savings = 100; }, 'a', '2026-01-01');
    const current = snapshotFor((i) => { i.asset.savings = 600; }, 'b', '2026-02-01');
    const beforePrev = JSON.stringify(previous);
    const beforeCurr = JSON.stringify(current);
    compareSnapshots(previous, current);
    expect(JSON.stringify(previous)).toBe(beforePrev);
    expect(JSON.stringify(current)).toBe(beforeCurr);
  });
});
