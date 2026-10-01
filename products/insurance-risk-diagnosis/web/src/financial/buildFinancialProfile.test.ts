import { describe, test, expect } from 'vitest';
import { runDiagnosis, emptyDiagnosisInput } from '../calc';
import type { DiagnosisInput } from '../types/diagnosis';
import { buildFinancialProfile } from './buildFinancialProfile';

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
      hasCancerCoverage: true, hasCareCoverage: false, hasPersonalPension: true, monthlyPremiumTotal: 2.5,
    },
    health: { hasMedicalHistory: true },
    retirement: { desiredRetirementAge: 65, expectedSeverancePay: 800, desiredMonthlyLivingCost: 22 },
  };
}

describe('buildFinancialProfile', () => {
  test('householdは入力をそのまま反映する', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    expect(profile.household).toEqual({
      age: 42, gender: 'male', occupationType: 'employee', occupationRisk: 'mid',
      hasSpouse: true, spouseAge: 40, childrenCount: 2, childrenAges: [8, 3], educationCourse: 'public_then_private_univ',
    });
  });

  test('incomeは本人・配偶者の年収をそのまま保持する', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    expect(profile.income).toEqual({ annualIncome: 650, spouseAnnualIncome: 200 });
  });

  test('配偶者年収が未入力の場合はundefinedのまま保持し、0で埋めない', () => {
    const input = richInput();
    input.basic.spouseAnnualIncome = undefined;
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    expect(profile.income.spouseAnnualIncome).toBeUndefined();
  });

  test('livingのeducationCostRemainingは診断エンジン(deathCoverage.breakdown)の値をそのまま転記する(再計算しない)', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    expect(profile.living.educationCostRemaining).toBe(result.deathCoverage.breakdown.educationTotal);
  });

  test('assets/liabilitiesは入力の資産・負債をそのまま反映する', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    expect(profile.assets).toEqual({ savings: 300, investments: 500, realEstateValue: 3000 });
    expect(profile.liabilities).toEqual({ mortgageBalance: 2500, hasMortgageLifeInsurance: false, otherLoanBalance: 50 });
  });

  test('protection.gapsByCategoryはgapを持つカテゴリ(死亡・医療・就業不能・老後・介護)のみを含み、DiagnosisResultの値をそのまま参照する', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    for (const key of ['death', 'medical', 'disability', 'retirement', 'care'] as const) {
      const category = result.categories.find((c) => c.key === key)!;
      expect(profile.protection.gapsByCategory[key]).toBe(category.gap);
    }
    expect(profile.protection.gapsByCategory.asset).toBeUndefined();
    expect(profile.protection.gapsByCategory.inheritance).toBeUndefined();
  });

  test('inheritanceのestimatedEstateAssetsは資産+死亡保険金の単純合算であり、相続税評価額を新たに計算しない', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    expect(profile.inheritance.estimatedEstateAssets).toBe(300 + 500 + 3000 + 1000);
    expect(profile.inheritance.estimatedLiabilities).toBe(2500 + 50);
  });

  test('入力オブジェクト・診断結果オブジェクトを変更しない', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const inputBefore = JSON.stringify(input);
    const resultBefore = JSON.stringify(result);
    buildFinancialProfile(input, result);
    expect(JSON.stringify(input)).toBe(inputBefore);
    expect(JSON.stringify(result)).toBe(resultBefore);
  });

  test('emptyDiagnosisInput(既定値)でも例外を投げない', () => {
    const input = emptyDiagnosisInput();
    const result = runDiagnosis(input);
    expect(() => buildFinancialProfile(input, result)).not.toThrow();
  });
});
