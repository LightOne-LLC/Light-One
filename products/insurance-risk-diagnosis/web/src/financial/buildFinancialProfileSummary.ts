import type { DiagnosisResult } from '../types/diagnosis';
import { findMissingInformation } from './missingInformation';
import type { CashFlowView, FinancialProfile, FinancialProfileSummary, ProtectionGapEntry } from './types';

/**
 * FinancialProfileを、Balance Sheet / Cash Flow / Protection Gap という
 * 「事実を整理した3つの見方」に変換する純粋関数。
 *
 * 「資産が多い=リスクが低い」のような新しい評価・スコアリングは一切行わない。
 * 不足しているデータ(未入力の年間生活費・配偶者年収等)は 'unknown' として扱い、
 * 推測で埋めない。
 */
export function buildFinancialProfileSummary(profile: FinancialProfile, diagnosis: DiagnosisResult): FinancialProfileSummary {
  const cashFlow = buildCashFlowView(profile);
  const assetsTotal = profile.assets.savings + profile.assets.investments + profile.assets.realEstateValue;
  const liabilitiesTotal = profile.liabilities.mortgageBalance + profile.liabilities.otherLoanBalance;

  const protectionGapEntries: ProtectionGapEntry[] = Object.entries(profile.protection.gapsByCategory)
    .map(([key, gap]) => {
      const category = diagnosis.categories.find((c) => c.key === key);
      if (!category || !gap) return null;
      return { key: category.key, label: category.label, gap } satisfies ProtectionGapEntry;
    })
    .filter((entry): entry is ProtectionGapEntry => entry !== null);

  return {
    household: profile.household,
    cashFlow,
    balanceSheet: {
      assets: {
        cash: profile.assets.savings,
        investments: profile.assets.investments,
        realEstate: profile.assets.realEstateValue,
        total: assetsTotal,
      },
      liabilities: {
        mortgage: profile.liabilities.mortgageBalance,
        otherDebt: profile.liabilities.otherLoanBalance,
        total: liabilitiesTotal,
      },
      netPosition: assetsTotal - liabilitiesTotal,
    },
    protection: { byCategory: protectionGapEntries },
    retirement: profile.retirement,
    inheritance: profile.inheritance,
    missingInformation: findMissingInformation(profile),
  };
}

function buildCashFlowView(profile: FinancialProfile): CashFlowView {
  const selfMonthlyIncome = profile.income.annualIncome / 12;

  const spouseMonthlyIncome: CashFlowView['spouseMonthlyIncome'] = !profile.household.hasSpouse
    ? 0
    : profile.income.spouseAnnualIncome !== undefined
      ? profile.income.spouseAnnualIncome / 12
      : 'unknown';

  const monthlyLivingCost: CashFlowView['monthlyLivingCost'] =
    profile.living.monthlyLivingExpense !== undefined ? profile.living.monthlyLivingExpense : 'unknown';

  const monthlySurplus: CashFlowView['monthlySurplus'] =
    spouseMonthlyIncome === 'unknown' || monthlyLivingCost === 'unknown'
      ? 'unknown'
      : selfMonthlyIncome + spouseMonthlyIncome - monthlyLivingCost;

  return { selfMonthlyIncome, spouseMonthlyIncome, monthlyLivingCost, monthlySurplus };
}
