import type { FinancialProfile, MissingInformationItem } from './types';

/**
 * FinancialProfile内で「未入力(型レベルでoptionalかつundefined)」の項目を
 * 一覧化する純粋関数。0や既定値を「未入力」とみなして推測することはしない
 * — DiagnosisInputの型で明示的にoptionalな項目のみを対象にする。
 */
export function findMissingInformation(profile: FinancialProfile): MissingInformationItem[] {
  const items: MissingInformationItem[] = [];

  if (profile.household.hasSpouse && profile.household.spouseAge === undefined) {
    items.push({ key: 'spouseAge', label: '配偶者の年齢', category: 'household' });
  }
  if (profile.household.hasSpouse && profile.income.spouseAnnualIncome === undefined) {
    items.push({ key: 'spouseAnnualIncome', label: '配偶者の年収', category: 'income' });
  }
  if (profile.living.monthlyLivingExpense === undefined) {
    items.push({ key: 'monthlyLivingExpense', label: '月間生活費', category: 'living' });
  }
  if (profile.retirement.desiredMonthlyLivingCost === undefined) {
    items.push({ key: 'desiredMonthlyLivingCost', label: '老後の希望生活費', category: 'retirement' });
  }

  return items;
}
