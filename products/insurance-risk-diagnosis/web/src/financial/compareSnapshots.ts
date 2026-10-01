import type { RiskCategoryKey } from '../types/diagnosis';
import type { FinancialChange, FinancialSnapshot } from './types';

const CATEGORY_ORDER: RiskCategoryKey[] = ['death', 'medical', 'disability', 'retirement', 'care', 'asset', 'inheritance'];

function numericChange(
  key: string,
  label: string,
  previous: number | null | undefined,
  current: number | null | undefined,
  unit?: string,
): FinancialChange {
  const p = previous ?? null;
  const c = current ?? null;
  let direction: FinancialChange['direction'];
  if (p === null && c === null) direction = 'unchanged';
  else if (p === null || c === null) direction = 'changed';
  else if (c > p) direction = 'increased';
  else if (c < p) direction = 'decreased';
  else direction = 'unchanged';
  return { key, label, previous: p, current: c, direction, unit };
}

/**
 * 2つのFinancialSnapshotを比較し、事実としての変化のみを返す純粋関数。
 * 「良くなった/悪くなった」という評価はここでは行わない(increased/decreasedは
 * 値の増減という事実のみを表し、それがリスク上望ましいかどうかの判断はUI側の責務)。
 * previous/currentのDiagnosisResult・FinancialProfileは一切変更しない。
 */
export function compareSnapshots(previous: FinancialSnapshot, current: FinancialSnapshot): FinancialChange[] {
  const changes: FinancialChange[] = [];

  changes.push(numericChange('overallScore', '総合スコア', previous.diagnosis.overallScore, current.diagnosis.overallScore));

  for (const key of CATEGORY_ORDER) {
    const prevCategory = previous.diagnosis.categories.find((c) => c.key === key);
    const currCategory = current.diagnosis.categories.find((c) => c.key === key);
    if (!prevCategory && !currCategory) continue;
    changes.push(
      numericChange(`category:${key}`, currCategory?.label ?? prevCategory?.label ?? key, prevCategory?.score, currCategory?.score),
    );
  }

  changes.push(numericChange(
    'requiredDeathCoverage', '必要死亡保障額',
    previous.diagnosis.deathCoverage.requiredAmount, current.diagnosis.deathCoverage.requiredAmount, '万円',
  ));

  const p = previous.profile;
  const c = current.profile;
  changes.push(numericChange('savings', '貯蓄額', p.assets.savings, c.assets.savings, '万円'));
  changes.push(numericChange('investments', '投資性資産', p.assets.investments, c.assets.investments, '万円'));
  changes.push(numericChange('realEstateValue', '不動産評価額', p.assets.realEstateValue, c.assets.realEstateValue, '万円'));
  changes.push(numericChange('mortgageBalance', '住宅ローン残高', p.liabilities.mortgageBalance, c.liabilities.mortgageBalance, '万円'));
  changes.push(numericChange('otherLoanBalance', 'その他借入残高', p.liabilities.otherLoanBalance, c.liabilities.otherLoanBalance, '万円'));
  changes.push(numericChange('annualIncome', '年収', p.income.annualIncome, c.income.annualIncome, '万円'));
  changes.push(numericChange('spouseAnnualIncome', '配偶者の年収', p.income.spouseAnnualIncome, c.income.spouseAnnualIncome, '万円'));
  changes.push(numericChange('monthlyLivingExpense', '月間生活費', p.living.monthlyLivingExpense, c.living.monthlyLivingExpense, '万円'));
  changes.push(numericChange('existingDeathCoverage', '既存の死亡保険金', p.protection.existingDeathCoverage, c.protection.existingDeathCoverage, '万円'));
  changes.push(numericChange('monthlyPremiumTotal', '月額保険料合計', p.protection.monthlyPremiumTotal, c.protection.monthlyPremiumTotal, '万円'));
  changes.push(numericChange('expectedSeverancePay', '退職金見込み額', p.retirement.expectedSeverancePay, c.retirement.expectedSeverancePay, '万円'));
  changes.push(numericChange('childrenCount', '子供の人数', p.household.childrenCount, c.household.childrenCount, '人'));

  changes.push({
    key: 'assumptionsVersion',
    label: '前提とした制度の時点',
    previous: previous.version.diagnosis,
    current: current.version.diagnosis,
    direction: previous.version.diagnosis === current.version.diagnosis ? 'unchanged' : 'changed',
  });

  return changes;
}
