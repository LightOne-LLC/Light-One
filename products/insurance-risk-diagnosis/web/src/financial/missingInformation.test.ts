import { describe, test, expect } from 'vitest';
import { runDiagnosis, emptyDiagnosisInput } from '../calc';
import type { DiagnosisInput } from '../types/diagnosis';
import { buildFinancialProfile } from './buildFinancialProfile';
import { findMissingInformation } from './missingInformation';

function profileFor(overrides: (input: DiagnosisInput) => void) {
  const input = emptyDiagnosisInput();
  overrides(input);
  const result = runDiagnosis(input);
  return buildFinancialProfile(input, result);
}

describe('findMissingInformation', () => {
  test('配偶者ありで配偶者の年齢・年収が未入力の場合、両方をmissingとして検出する', () => {
    const profile = profileFor((i) => {
      i.basic.hasSpouse = true;
      i.basic.spouseAge = undefined;
      i.basic.spouseAnnualIncome = undefined;
    });
    const missing = findMissingInformation(profile);
    expect(missing.some((m) => m.key === 'spouseAge')).toBe(true);
    expect(missing.some((m) => m.key === 'spouseAnnualIncome')).toBe(true);
  });

  test('配偶者なしの場合、配偶者関連項目はmissingとして扱わない(未入力ではなく該当なし)', () => {
    const profile = profileFor((i) => { i.basic.hasSpouse = false; });
    const missing = findMissingInformation(profile);
    expect(missing.some((m) => m.key === 'spouseAge')).toBe(false);
    expect(missing.some((m) => m.key === 'spouseAnnualIncome')).toBe(false);
  });

  test('月間生活費が未入力の場合はmissingとして検出する', () => {
    const profile = profileFor((i) => { i.basic.monthlyLivingExpense = undefined; });
    expect(findMissingInformation(profile).some((m) => m.key === 'monthlyLivingExpense')).toBe(true);
  });

  test('月間生活費が入力済みの場合はmissingに含まれない', () => {
    const profile = profileFor((i) => { i.basic.monthlyLivingExpense = 25; });
    expect(findMissingInformation(profile).some((m) => m.key === 'monthlyLivingExpense')).toBe(false);
  });

  test('老後の希望生活費が未入力の場合はmissingとして検出する', () => {
    const profile = profileFor((i) => { i.retirement.desiredMonthlyLivingCost = undefined; });
    expect(findMissingInformation(profile).some((m) => m.key === 'desiredMonthlyLivingCost')).toBe(true);
  });

  test('0円の入力(貯蓄0円等)はmissingとして扱わない(明示的なゼロと未入力を混同しない)', () => {
    const profile = profileFor((i) => {
      i.asset.savings = 0;
      i.asset.mortgageBalance = 0;
      i.existingInsurance.deathCoverage = 0;
    });
    const missing = findMissingInformation(profile);
    expect(missing.some((m) => m.key.includes('savings') || m.key.includes('mortgage') || m.key.includes('deathCoverage'))).toBe(false);
  });

  test('すべて入力済みの場合は空配列を返す', () => {
    const profile = profileFor((i) => {
      i.basic.hasSpouse = true;
      i.basic.spouseAge = 38;
      i.basic.spouseAnnualIncome = 300;
      i.basic.monthlyLivingExpense = 25;
      i.retirement.desiredMonthlyLivingCost = 20;
    });
    expect(findMissingInformation(profile)).toEqual([]);
  });
});
