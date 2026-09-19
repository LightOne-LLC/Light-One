import { describe, test, expect } from 'vitest';
import { runDiagnosis } from '../calc';
import type { DiagnosisInput } from '../types/diagnosis';
import { buildDiagnosisExplanation } from './explanation';
import { NEXT_STEPS } from '../lib/nextSteps';

function richInput(): DiagnosisInput {
  return {
    basic: {
      age: 42, gender: 'male', occupationType: 'employee', occupationRisk: 'mid', annualIncome: 650,
      hasSpouse: true, spouseAge: 40, spouseAnnualIncome: 200,
      children: [{ currentAge: 8 }, { currentAge: 3 }], educationCourse: 'public_then_private_univ',
      monthlyLivingExpense: 28,
    },
    asset: { savings: 300, otherAssets: 500, realEstateValue: 3000, hasMortgageLifeInsurance: false, mortgageBalance: 2500, otherLoanBalance: 50 },
    existingInsurance: {
      deathCoverage: 1000, hasMedicalCoverage: true, hasDisabilityCoverage: false, hasSavingsTypeCoverage: false,
      hasCancerCoverage: false, hasCareCoverage: false, hasPersonalPension: true, monthlyPremiumTotal: 2.5,
    },
    health: { hasMedicalHistory: true },
    retirement: { desiredRetirementAge: 65, expectedSeverancePay: 800, desiredMonthlyLivingCost: 22 },
  };
}

describe('buildDiagnosisExplanation', () => {
  test('7カテゴリすべてに対して説明を組み立てる', () => {
    const result = runDiagnosis(richInput());
    const explanation = buildDiagnosisExplanation(result);
    expect(explanation.categories).toHaveLength(7);
    expect(explanation.categories.map((c) => c.key).sort()).toEqual(
      result.categories.map((c) => c.key).sort(),
    );
  });

  test('assumptionsのtextはDiagnosisResult.assumptionsをそのまま保持する(改変しない)', () => {
    const result = runDiagnosis(richInput());
    const explanation = buildDiagnosisExplanation(result);
    expect(explanation.assumptions.map((a) => a.text)).toEqual(result.assumptions);
  });

  test('assumptionsのevidenceは捏造せず、direct matchする資料があるものだけに付く', () => {
    const result = runDiagnosis(richInput());
    const explanation = buildDiagnosisExplanation(result);
    // riskProfile.tsのassumptionsは全行diagnosis-assumptions-generalの管轄内であるため全行に出典が付く
    for (const assumption of explanation.assumptions) {
      expect(assumption.evidence.length).toBeGreaterThan(0);
      expect(assumption.evidence.every((s) => s.sourceId === 'diagnosis-assumptions-general')).toBe(true);
    }
  });

  test('whyは既存のreasonsをそのまま保持する', () => {
    const result = runDiagnosis(richInput());
    const explanation = buildDiagnosisExplanation(result);
    for (const category of explanation.categories) {
      const original = result.categories.find((c) => c.key === category.key);
      expect(category.why).toEqual(original?.reasons);
      expect(category.score).toBe(original?.score);
      expect(category.level).toBe(original?.level);
    }
  });

  test('suggestedActionsはNEXT_STEPSの内容・件数と一致する', () => {
    const result = runDiagnosis(richInput());
    const explanation = buildDiagnosisExplanation(result);
    for (const category of explanation.categories) {
      expect(category.suggestedActions.map((a) => a.action)).toEqual(NEXT_STEPS[category.key]);
    }
  });

  test('診断結果(DiagnosisResult)を一切変更しない', () => {
    const result = runDiagnosis(richInput());
    const before = JSON.stringify(result);
    buildDiagnosisExplanation(result);
    expect(JSON.stringify(result)).toBe(before);
  });

  test('publicProtectionNoteは公的制度(Tier1)由来の根拠がある場合のみ設定される', () => {
    const result = runDiagnosis(richInput());
    const explanation = buildDiagnosisExplanation(result);
    for (const category of explanation.categories) {
      const hasPublicSource = category.evidence.some((e) => e.source.sourceId.startsWith('public-'));
      expect(Boolean(category.publicProtectionNote)).toBe(hasPublicSource);
    }
  });

  test('公的制度の直接対応が無いカテゴリ(asset)でも例外を投げず、publicProtectionNoteは設定されない', () => {
    const result = runDiagnosis(richInput());
    const explanation = buildDiagnosisExplanation(result);
    const assetExplanation = explanation.categories.find((c) => c.key === 'asset');
    expect(assetExplanation).toBeDefined();
    expect(assetExplanation?.publicProtectionNote).toBeUndefined();
  });
});
