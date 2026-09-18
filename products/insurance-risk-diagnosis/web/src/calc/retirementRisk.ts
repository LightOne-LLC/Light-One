import type { DiagnosisInput, RiskCategoryResult } from '../types/diagnosis';
import { LIVING_COST_RATIO, RETIREMENT_END_AGE } from './params';
import { OLD_AGE_BASIC_PENSION_ANNUAL, OLD_AGE_EMPLOYEE_PENSION_RATE } from './publicSystemParams';

// 老後の必要資金と、公的年金・退職金・現有資産による備えを比較し、不足額を評価する。
export function calcRetirementRisk(input: DiagnosisInput): RiskCategoryResult {
  const { basic, asset, retirement } = input;

  const retirementAge = retirement.desiredRetirementAge;
  const years = Math.max(0, RETIREMENT_END_AGE - retirementAge);
  const monthlyLivingCost = retirement.desiredMonthlyLivingCost
    ?? (basic.monthlyLivingExpense ?? (basic.annualIncome * LIVING_COST_RATIO) / 12) * 0.8; // 老後は現役時の生活費の8割程度を想定

  // 公的年金(簡易概算): 自営業は老齢基礎年金のみ、会社員/公務員は基礎年金+報酬比例部分の概算を上乗せ
  const selfBasicPension = OLD_AGE_BASIC_PENSION_ANNUAL;
  const selfEmployeePension = basic.occupationType === 'self_employed' ? 0 : basic.annualIncome * OLD_AGE_EMPLOYEE_PENSION_RATE;
  const spousePension = basic.hasSpouse ? OLD_AGE_BASIC_PENSION_ANNUAL : 0; // 配偶者も基礎年金を受給する前提(簡易概算)
  const annualPublicPension = selfBasicPension + selfEmployeePension + spousePension;
  const monthlyPublicPension = annualPublicPension / 12;

  const requiredAmount = Math.max(0, monthlyLivingCost - monthlyPublicPension) * 12 * years;
  const ownAssets = asset.savings + asset.otherAssets + retirement.expectedSeverancePay;
  const shortfall = Math.max(0, requiredAmount - ownAssets);

  const yearsToRetirement = Math.max(0, retirementAge - basic.age);
  const urgency = yearsToRetirement > 0 ? Math.min(1, 1 / yearsToRetirement) : 1;
  const gapRatio = requiredAmount > 0 ? shortfall / requiredAmount : 0;

  const score = Math.min(100, Math.round(gapRatio * 70 + urgency * 30));

  const reasons = [
    `老後生活費の目安: 月${monthlyLivingCost.toFixed(1)}万円(${retirement.desiredMonthlyLivingCost !== undefined ? '入力値' : '現役生活費の8割目安'})`,
    basic.occupationType === 'self_employed'
      ? `公的年金(自営業・国民年金のみ): 老齢基礎年金満額 年${selfBasicPension.toFixed(1)}万円`
      : `公的年金(会社員/公務員): 老齢基礎年金 年${selfBasicPension.toFixed(1)}万円 + 老齢厚生年金(報酬比例部分の概算) 年${selfEmployeePension.toFixed(1)}万円`,
    basic.hasSpouse ? `配偶者の老齢基礎年金(概算): 年${spousePension.toFixed(1)}万円` : '配偶者なしのため配偶者分の年金は考慮しない',
    `退職後${retirementAge}歳から${RETIREMENT_END_AGE}歳までの${years}年間、生活費と年金の差額を資産で補う前提`,
    `必要額(概算): (月${monthlyLivingCost.toFixed(1)}万円 − 公的年金月${monthlyPublicPension.toFixed(1)}万円) × 12ヶ月 × ${years}年 = ${requiredAmount.toFixed(1)}万円`,
    `現有資産(貯蓄+投資性資産+退職金見込み): ${ownAssets.toFixed(1)}万円`,
    `不足額: ${shortfall.toFixed(1)}万円、退職まで残り${yearsToRetirement}年`,
  ];

  return {
    key: 'retirement',
    label: '老後',
    score,
    level: 'low',
    reasons,
    gap: { requiredAmount, publicCoverage: monthlyPublicPension * 12 * years, ownAssets, existingInsurance: 0, shortfall },
  };
}
