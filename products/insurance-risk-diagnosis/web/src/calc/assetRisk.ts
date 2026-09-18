import type { DiagnosisInput, RiskCategoryResult } from '../types/diagnosis';
import { LIVING_COST_RATIO } from './params';

// 「資産形成が足りているか」ではなく、緊急予備資金の流動性・負債とのバランスを評価する。
// 老後資金の過不足は retirementRisk が担当するため、ここでは重複させない。
export function calcAssetRisk(input: DiagnosisInput): RiskCategoryResult {
  const { basic, asset } = input;

  const monthlyLivingCost = basic.monthlyLivingExpense ?? (basic.annualIncome * LIVING_COST_RATIO) / 12;
  const emergencyFundMonths = monthlyLivingCost > 0 ? asset.savings / monthlyLivingCost : 99;
  const recommendedMonths = 6; // 一般的に推奨される生活防衛資金の目安(半年分)
  const emergencyFundScore = Math.min(60, Math.max(0, (1 - emergencyFundMonths / recommendedMonths) * 60));

  const totalAssets = asset.savings + asset.otherAssets + asset.realEstateValue;
  const totalDebt = asset.mortgageBalance + asset.otherLoanBalance;
  const debtRatio = totalAssets > 0 ? totalDebt / totalAssets : totalDebt > 0 ? 1 : 0;
  const debtScore = Math.min(40, Math.max(0, debtRatio * 40));

  const score = Math.min(100, Math.round(emergencyFundScore + debtScore));

  const reasons = [
    `緊急予備資金: 貯蓄${asset.savings}万円 ÷ 月間生活費${monthlyLivingCost.toFixed(1)}万円 ≈ ${emergencyFundMonths.toFixed(1)}ヶ月分(目安は${recommendedMonths}ヶ月分)`,
    `総資産(現金+投資性資産+不動産評価額): ${totalAssets.toFixed(1)}万円`,
    `総負債(住宅ローン+その他借入): ${totalDebt.toFixed(1)}万円、資産に対する負債比率: ${(debtRatio * 100).toFixed(0)}%`,
  ];

  return {
    key: 'asset',
    label: '資産',
    score,
    level: 'low',
    reasons,
  };
}
