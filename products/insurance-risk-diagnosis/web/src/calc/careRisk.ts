import type { DiagnosisInput, RiskCategoryResult } from '../types/diagnosis';
import {
  CARE_MONTHLY_COST_AVERAGE, CARE_ONE_TIME_COST_AVERAGE, CARE_AVERAGE_PERIOD_YEARS, CARE_SELF_PAY_RATIO,
} from './publicSystemParams';

// 介護保険は原則65歳以上(特定疾病等の例外を除く)が対象であり、将来のリスクとして評価する。
export function calcCareRisk(input: DiagnosisInput): RiskCategoryResult {
  const { asset, existingInsurance } = input;

  const monthlySelfPay = CARE_MONTHLY_COST_AVERAGE; // 介護保険の自己負担割合(1〜3割)控除後の平均自己負担目安(月額)
  const requiredAmount = monthlySelfPay * 12 * CARE_AVERAGE_PERIOD_YEARS + CARE_ONE_TIME_COST_AVERAGE;
  const existingCoverageValue = existingInsurance.hasCareCoverage ? requiredAmount * 0.4 : 0;
  const ownAssets = Math.min(asset.savings + asset.otherAssets, Math.max(0, requiredAmount - existingCoverageValue));
  const shortfall = Math.max(0, requiredAmount - existingCoverageValue - ownAssets);

  const gapRatio = requiredAmount > 0 ? shortfall / requiredAmount : 0;
  const score = Math.min(100, Math.round(gapRatio * 100));

  const reasons = [
    `介護保険制度により自己負担は原則1〜3割(本モデルは最も一般的な${(CARE_SELF_PAY_RATIO * 100).toFixed(0)}割負担を想定)`,
    `平均的な自己負担目安: 月${monthlySelfPay}万円 × 12ヶ月 × 平均介護期間${CARE_AVERAGE_PERIOD_YEARS}年 + 住宅改修等の一時費用${CARE_ONE_TIME_COST_AVERAGE}万円 = ${requiredAmount.toFixed(1)}万円`,
    existingInsurance.hasCareCoverage
      ? `既存の介護保険で概ね4割をカバーすると仮定: −${existingCoverageValue.toFixed(1)}万円`
      : '介護保険(民間)未加入のため、自己負担分は資産のみで対応する前提',
    `金融資産でカバーできる額: ${ownAssets.toFixed(1)}万円、残る不足額: ${shortfall.toFixed(1)}万円`,
  ];

  return {
    key: 'care',
    label: '介護',
    score,
    level: 'low',
    reasons,
    gap: { requiredAmount, publicCoverage: 0, ownAssets, existingInsurance: existingCoverageValue, shortfall },
  };
}
