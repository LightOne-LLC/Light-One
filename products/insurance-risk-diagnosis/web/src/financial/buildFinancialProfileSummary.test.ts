import { describe, test, expect } from 'vitest';
import { runDiagnosis, emptyDiagnosisInput } from '../calc';
import type { DiagnosisInput } from '../types/diagnosis';
import { buildFinancialProfile } from './buildFinancialProfile';
import { buildFinancialProfileSummary } from './buildFinancialProfileSummary';

function build(overrides: (input: DiagnosisInput) => void) {
  const input = emptyDiagnosisInput();
  overrides(input);
  const result = runDiagnosis(input);
  const profile = buildFinancialProfile(input, result);
  return { input, result, profile };
}

describe('buildFinancialProfileSummary — Balance Sheet', () => {
  test('資産合計・負債合計・純資産を単純合算のみで算出する(新しい評価は行わない)', () => {
    const { profile, result } = build((i) => {
      i.asset.savings = 300; i.asset.otherAssets = 200; i.asset.realEstateValue = 3000;
      i.asset.mortgageBalance = 2500; i.asset.otherLoanBalance = 50;
    });
    const summary = buildFinancialProfileSummary(profile, result);
    expect(summary.balanceSheet.assets).toEqual({ cash: 300, investments: 200, realEstate: 3000, total: 3500 });
    expect(summary.balanceSheet.liabilities).toEqual({ mortgage: 2500, otherDebt: 50, total: 2550 });
    expect(summary.balanceSheet.netPosition).toBe(3500 - 2550);
  });
});

describe('buildFinancialProfileSummary — Cash Flow', () => {
  test('配偶者なしの場合、spouseMonthlyIncomeは0(未入力ではなく該当なし)', () => {
    const { profile, result } = build((i) => { i.basic.hasSpouse = false; i.basic.annualIncome = 600; });
    const summary = buildFinancialProfileSummary(profile, result);
    expect(summary.cashFlow.selfMonthlyIncome).toBeCloseTo(50, 5);
    expect(summary.cashFlow.spouseMonthlyIncome).toBe(0);
  });

  test('配偶者ありで年収未入力の場合、spouseMonthlyIncomeとmonthlySurplusは"unknown"になる(推測しない)', () => {
    const { profile, result } = build((i) => {
      i.basic.hasSpouse = true; i.basic.spouseAnnualIncome = undefined; i.basic.monthlyLivingExpense = 25;
    });
    const summary = buildFinancialProfileSummary(profile, result);
    expect(summary.cashFlow.spouseMonthlyIncome).toBe('unknown');
    expect(summary.cashFlow.monthlySurplus).toBe('unknown');
  });

  test('月間生活費が未入力の場合、monthlyLivingCostとmonthlySurplusは"unknown"になる', () => {
    const { profile, result } = build((i) => { i.basic.monthlyLivingExpense = undefined; i.basic.hasSpouse = false; });
    const summary = buildFinancialProfileSummary(profile, result);
    expect(summary.cashFlow.monthlyLivingCost).toBe('unknown');
    expect(summary.cashFlow.monthlySurplus).toBe('unknown');
  });

  test('必要な値がすべて揃っている場合、monthlySurplusは実数として計算される', () => {
    const { profile, result } = build((i) => {
      i.basic.hasSpouse = true; i.basic.spouseAnnualIncome = 240; i.basic.annualIncome = 600; i.basic.monthlyLivingExpense = 30;
    });
    const summary = buildFinancialProfileSummary(profile, result);
    expect(summary.cashFlow.monthlySurplus).toBeCloseTo(50 + 20 - 30, 5);
  });
});

describe('buildFinancialProfileSummary — Protection Gap', () => {
  test('DiagnosisResultのgapをそのまま参照し、再計算しない', () => {
    const { profile, result } = build(() => {});
    const summary = buildFinancialProfileSummary(profile, result);
    for (const entry of summary.protection.byCategory) {
      const category = result.categories.find((c) => c.key === entry.key)!;
      expect(entry.gap).toBe(category.gap);
      expect(entry.label).toBe(category.label);
    }
  });

  test('資産・相続カテゴリはgapを持たないため含まれない', () => {
    const { profile, result } = build(() => {});
    const summary = buildFinancialProfileSummary(profile, result);
    expect(summary.protection.byCategory.some((e) => e.key === 'asset')).toBe(false);
    expect(summary.protection.byCategory.some((e) => e.key === 'inheritance')).toBe(false);
  });
});

describe('buildFinancialProfileSummary — missingInformation', () => {
  test('summaryにmissingInformationが含まれる', () => {
    const { profile, result } = build((i) => { i.basic.monthlyLivingExpense = undefined; });
    const summary = buildFinancialProfileSummary(profile, result);
    expect(summary.missingInformation.some((m) => m.key === 'monthlyLivingExpense')).toBe(true);
  });
});

describe('buildFinancialProfileSummary — 非破壊性', () => {
  test('profile/resultを変更しない', () => {
    const { profile, result } = build(() => {});
    const before = JSON.stringify({ profile, result });
    buildFinancialProfileSummary(profile, result);
    expect(JSON.stringify({ profile, result })).toBe(before);
  });
});
