import { describe, test, expect } from 'vitest';
import { runDiagnosis, emptyDiagnosisInput } from '../calc';
import type { DiagnosisInput, DiagnosisResult } from '../types/diagnosis';
import { buildDiagnosisExplanation } from '../rag';
import { buildFinancialProfile } from './buildFinancialProfile';
import { buildFinancialSnapshot } from './buildFinancialSnapshot';
import { compareSnapshots } from './compareSnapshots';
import { buildFinancialIntelligence } from './buildFinancialIntelligence';

/*
  diagnosisStore.ts の normalizeResult() が実際に生成する「旧バージョン(7領域化前)の
  正規化済みDiagnosisResult」の形を、ここで直接再現する。
  normalizeResult()自体は非公開関数のため呼び出せないが、financialモジュールが
  実際に向き合う契約の境界は「normalizeResult()を経た後のDiagnosisResultの形」であり、
  そこを直接検証する方が、localStorageやdiagnosisStoreの内部実装に依存しないテストになる。

  normalizeResult()のソース(diagnosisStore.ts)が実際に組み立てる形:
    - categoriesは death/medical/disability/retirement の4件のみ(care/asset/inheritanceは無い)
    - いずれのcategoryにも gap フィールドが存在しない(旧データには無かったため)
    - assumptionsは固定の案内文1件のみ
  deathCoverage/medicalRisk/disabilityRisk/assetFormation自体は保存時のまま変更されない。
*/
function legacyNormalizedResult(modern: DiagnosisResult): DiagnosisResult {
  const legacyCategories: DiagnosisResult['categories'] = [
    { key: 'death', label: '死亡', score: 60, level: 'high', reasons: ['旧バージョンの判定理由(死亡)'] },
    { key: 'medical', label: '医療', score: 30, level: 'medium', reasons: ['旧バージョンの判定理由(医療)'] },
    { key: 'disability', label: '就業不能', score: 40, level: 'medium', reasons: ['旧バージョンの判定理由(就業不能)'] },
    { key: 'retirement', label: '老後', score: 50, level: 'medium', reasons: ['旧バージョンの判定理由(老後)'] },
  ];
  return {
    ...modern,
    categories: legacyCategories,
    overallScore: Math.round(legacyCategories.reduce((s, c) => s + c.score, 0) / legacyCategories.length),
    assumptions: ['この診断結果はアップグレード前のバージョンで保存されたため、一部の項目(介護・資産・相続)は表示されません。'],
  };
}

function legacyInput(): DiagnosisInput {
  return emptyDiagnosisInput();
}

describe('旧バージョン(7領域化前)で保存されたDiagnosisResultとの互換性', () => {
  test('buildFinancialProfileが例外を投げず、gapを持たないカテゴリは単に除外される', () => {
    const input = legacyInput();
    const modernResult = runDiagnosis(input);
    const legacyResult = legacyNormalizedResult(modernResult);

    const profile = buildFinancialProfile(input, legacyResult);

    expect(Object.keys(profile.protection.gapsByCategory)).toEqual([]);
  });

  test('buildFinancialSnapshotが例外を投げない', () => {
    const input = legacyInput();
    const legacyResult = legacyNormalizedResult(runDiagnosis(input));
    expect(() => buildFinancialSnapshot({ id: 'legacy-1', createdAt: '2024-01-01T00:00:00.000Z', input, result: legacyResult })).not.toThrow();
  });

  test('buildFinancialIntelligenceが例外を投げず、riskAreasは存在する4領域のみから選ばれる', () => {
    const input = legacyInput();
    const legacyResult = legacyNormalizedResult(runDiagnosis(input));
    const profile = buildFinancialProfile(input, legacyResult);
    const snapshot = buildFinancialSnapshot({ id: 'legacy-1', createdAt: '2024-01-01T00:00:00.000Z', input, result: legacyResult });
    const evidence = buildDiagnosisExplanation(legacyResult);

    const intelligence = buildFinancialIntelligence(profile, legacyResult, [snapshot], evidence);

    expect(intelligence.riskAreas.length).toBeLessThanOrEqual(3);
    for (const area of intelligence.riskAreas) {
      expect(['death', 'medical', 'disability', 'retirement']).toContain(area.key);
    }
    expect(intelligence.currentState.protection.byCategory).toEqual([]);
  });

  test('旧レコード(care/asset/inheritanceカテゴリ無し)と現行レコードを比較しても例外を投げない', () => {
    const legacyInputData = legacyInput();
    const legacySnapshot = buildFinancialSnapshot({
      id: 'legacy-1', createdAt: '2024-01-01T00:00:00.000Z', input: legacyInputData,
      result: legacyNormalizedResult(runDiagnosis(legacyInputData)),
    });

    const modernInputData = legacyInput();
    modernInputData.asset.savings = 999;
    const modernSnapshot = buildFinancialSnapshot({
      id: 'modern-1', createdAt: '2026-01-01T00:00:00.000Z', input: modernInputData, result: runDiagnosis(modernInputData),
    });

    const changes = compareSnapshots(legacySnapshot, modernSnapshot);

    // 現行レコードにのみ存在するカテゴリ(介護・資産・相続)は、片側が無いことを
    // 捏造せず'changed'として扱う(previousがnull)
    const careChange = changes.find((c) => c.key === 'category:care')!;
    expect(careChange.previous).toBeNull();
    expect(careChange.current).not.toBeNull();
    expect(careChange.direction).toBe('changed');

    // 両方に存在するカテゴリ(死亡等)は通常通り比較できる
    const deathChange = changes.find((c) => c.key === 'category:death')!;
    expect(deathChange.previous).toBe(60);
  });

  test('旧レコード同士を比較しても例外を投げない(両方ともcare/asset/inheritanceが無い)', () => {
    const inputA = legacyInput();
    const snapshotA = buildFinancialSnapshot({ id: 'a', createdAt: '2024-01-01T00:00:00.000Z', input: inputA, result: legacyNormalizedResult(runDiagnosis(inputA)) });

    const inputB = legacyInput();
    inputB.asset.savings = 500;
    const snapshotB = buildFinancialSnapshot({ id: 'b', createdAt: '2024-06-01T00:00:00.000Z', input: inputB, result: legacyNormalizedResult(runDiagnosis(inputB)) });

    expect(() => compareSnapshots(snapshotA, snapshotB)).not.toThrow();
    const changes = compareSnapshots(snapshotA, snapshotB);
    // 両方に無いカテゴリは比較対象に含まれない(捏造しない)
    expect(changes.some((c) => c.key === 'category:care')).toBe(false);
  });

  test('deathCoverage.breakdownが欠けている極端なケースでもeducationCostRemainingは0として安全に扱われる(例外を投げない)', () => {
    const input = legacyInput();
    const result = runDiagnosis(input);
    // @ts-expect-error 意図的にbreakdownを欠落させた極端なレコードを再現する
    const brokenResult: DiagnosisResult = { ...result, deathCoverage: { ...result.deathCoverage, breakdown: undefined } };

    const profile = buildFinancialProfile(input, brokenResult);
    expect(profile.living.educationCostRemaining).toBe(0);
  });
});
