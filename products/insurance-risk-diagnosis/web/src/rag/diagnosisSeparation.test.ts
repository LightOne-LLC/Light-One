import { describe, test, expect } from 'vitest';
import { runDiagnosis } from '../calc';
import type { DiagnosisInput } from '../types/diagnosis';
import { explainCategories } from './explain';
import { buildEvidenceForCategories, findDirectSourcesForReason, findEvidenceForAssumption } from './evidenceMapping';
import { buildDiagnosisExplanation } from './explanation';

/*
  RAGは「診断結果を決めるAI」ではないことをテストで固定する。
  runDiagnosis(決定論的エンジン)の出力に、RAGモジュールを読み込んだ・呼び出したことによる
  副作用が一切ないことを確認する。
*/

function sampleInput(): DiagnosisInput {
  return {
    basic: {
      age: 42,
      gender: 'male',
      occupationType: 'employee',
      occupationRisk: 'mid',
      annualIncome: 650,
      hasSpouse: true,
      spouseAge: 40,
      spouseAnnualIncome: 200,
      children: [{ currentAge: 8 }, { currentAge: 3 }],
      educationCourse: 'public_then_private_univ',
      monthlyLivingExpense: 28,
    },
    asset: {
      savings: 300,
      otherAssets: 500,
      realEstateValue: 3000,
      hasMortgageLifeInsurance: false,
      mortgageBalance: 2500,
      otherLoanBalance: 50,
    },
    existingInsurance: {
      deathCoverage: 1000,
      hasMedicalCoverage: true,
      hasDisabilityCoverage: false,
      hasSavingsTypeCoverage: false,
      hasCancerCoverage: true,
      hasCareCoverage: false,
      hasPersonalPension: false,
      monthlyPremiumTotal: 3,
    },
    health: { hasMedicalHistory: true },
    retirement: { desiredRetirementAge: 65, expectedSeverancePay: 500, desiredMonthlyLivingCost: 25 },
  };
}

describe('RAG導入による既存診断エンジンへの非干渉', () => {
  test('RAGモジュールを呼び出しても、overallScore・category scores・requiredDeathCoverageが変わらない', () => {
    const input = sampleInput();

    const before = runDiagnosis(input);
    // RAGの主要API(retrieval → evidence mapping → explanation)をすべて実際に呼び出す
    explainCategories(before.categories);
    buildEvidenceForCategories(before.categories);
    buildDiagnosisExplanation(before);
    for (const category of before.categories) {
      for (const reason of category.reasons) findDirectSourcesForReason(reason, category.key);
    }
    for (const assumption of before.assumptions) findEvidenceForAssumption(assumption);
    const after = runDiagnosis(input);

    expect(after.overallScore).toBe(before.overallScore);
    expect(after.deathCoverage.requiredAmount).toBe(before.deathCoverage.requiredAmount);
    expect(after.categories.map((c) => c.score)).toEqual(before.categories.map((c) => c.score));
    expect(after.categories.map((c) => c.level)).toEqual(before.categories.map((c) => c.level));
    expect(after.categories.map((c) => c.reasons)).toEqual(before.categories.map((c) => c.reasons));
  });

  test('explainCategoriesはRiskCategoryResultを読み取るのみで、渡したオブジェクトを変更しない', () => {
    const input = sampleInput();
    const result = runDiagnosis(input);
    const snapshotBefore = JSON.stringify(result.categories);

    explainCategories(result.categories);

    expect(JSON.stringify(result.categories)).toBe(snapshotBefore);
  });

  test('buildDiagnosisExplanationはDiagnosisResultを変更せず、reasons/score/levelをそのまま保持する', () => {
    const input = sampleInput();
    const result = runDiagnosis(input);
    const snapshotBefore = JSON.stringify(result);

    const explanation = buildDiagnosisExplanation(result);

    expect(JSON.stringify(result)).toBe(snapshotBefore);
    for (const category of explanation.categories) {
      const original = result.categories.find((c) => c.key === category.key);
      expect(category.why).toEqual(original?.reasons);
      expect(category.score).toBe(original?.score);
      expect(category.level).toBe(original?.level);
    }
  });

  test('同じ入力に対しrunDiagnosisは常に同じスコアを返す(RAGの検索スコアのような非決定要素を持ち込まない)', () => {
    const input = sampleInput();
    const results = Array.from({ length: 5 }, () => runDiagnosis(input));
    const first = JSON.stringify({ overall: results[0].overallScore, categories: results[0].categories.map((c) => c.score) });
    for (const r of results.slice(1)) {
      expect(JSON.stringify({ overall: r.overallScore, categories: r.categories.map((c) => c.score) })).toBe(first);
    }
  });
});
