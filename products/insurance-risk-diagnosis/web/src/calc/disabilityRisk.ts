import type { DiagnosisInput, RiskCategoryResult } from '../types/diagnosis';
import { LIVING_COST_RATIO, DISABILITY_OCCUPATION_SCORE, DISABILITY_AGE_SCORE_TABLE, ageBand } from './params';
import { SICK_LEAVE_BENEFIT_RATIO, SICK_LEAVE_BENEFIT_MAX_MONTHS } from './publicSystemParams';

function bufferScoreFromMonths(months: number): number {
  if (months < 3) return 40;
  if (months < 6) return 30;
  if (months < 12) return 15;
  return 5;
}

export function calcDisabilityRisk(input: DiagnosisInput): RiskCategoryResult {
  const { basic, asset, existingInsurance } = input;
  const band = ageBand(basic.age);
  const occupationScore = DISABILITY_OCCUPATION_SCORE[basic.occupationRisk];
  const ageScore = DISABILITY_AGE_SCORE_TABLE[band];

  const monthlyIncome = basic.annualIncome / 12;
  const monthlyLivingCost = basic.monthlyLivingExpense ?? (basic.annualIncome * LIVING_COST_RATIO) / 12;
  const spouseMonthlyIncome = basic.hasSpouse ? (basic.spouseAnnualIncome ?? 0) / 12 : 0;

  const isEmployee = basic.occupationType !== 'self_employed';
  const sickLeaveMonthlyBenefit = isEmployee ? monthlyIncome * SICK_LEAVE_BENEFIT_RATIO : 0;

  // 就業不能状態が続く想定期間を、傷病手当金の支給上限(会社員/公務員)か、自営業は一律12ヶ月と仮定して評価する。
  const assumedMonths = isEmployee ? SICK_LEAVE_BENEFIT_MAX_MONTHS : 12;
  const requiredAmount = monthlyLivingCost * assumedMonths;
  const publicCoverage = sickLeaveMonthlyBenefit * Math.min(assumedMonths, SICK_LEAVE_BENEFIT_MAX_MONTHS);
  const spouseCoverage = spouseMonthlyIncome * assumedMonths;
  const existingCoverageValue = existingInsurance.hasDisabilityCoverage ? monthlyLivingCost * assumedMonths * 0.5 : 0;
  const ownAssets = Math.min(asset.savings, Math.max(0, requiredAmount - publicCoverage - spouseCoverage - existingCoverageValue));
  const shortfall = Math.max(0, requiredAmount - publicCoverage - spouseCoverage - existingCoverageValue - ownAssets);

  const bufferMonths = monthlyLivingCost > 0 ? asset.savings / monthlyLivingCost : 99;
  const bufferScore = bufferScoreFromMonths(bufferMonths);
  const gapRatio = requiredAmount > 0 ? shortfall / requiredAmount : 0;

  const score = Math.min(100, Math.round(occupationScore + ageScore + bufferScore * 0.4 + gapRatio * 40));

  const reasons = [
    `職業危険度(${basic.occupationRisk})による加点: ${occupationScore}点`,
    `年齢区分(${band})による加点: ${ageScore}点`,
    isEmployee
      ? `傷病手当金(会社員/公務員が対象): 月収${monthlyIncome.toFixed(1)}万円 × ${(SICK_LEAVE_BENEFIT_RATIO * 100).toFixed(0)}% = 月${sickLeaveMonthlyBenefit.toFixed(1)}万円(最長${SICK_LEAVE_BENEFIT_MAX_MONTHS}ヶ月)`
      : '自営業(国民健康保険)のため傷病手当金の対象外。公的な所得保障はない前提',
    spouseMonthlyIncome > 0 ? `配偶者収入による補填: 月${spouseMonthlyIncome.toFixed(1)}万円` : '配偶者収入による補填なし',
    `就業不能が${assumedMonths}ヶ月続く前提での必要額: 月間生活費${monthlyLivingCost.toFixed(1)}万円 × ${assumedMonths}ヶ月 = ${requiredAmount.toFixed(1)}万円`,
    `生活防衛資金 約${bufferMonths.toFixed(1)}ヶ月分(貯蓄${asset.savings}万円 ÷ 月間生活費${monthlyLivingCost.toFixed(1)}万円)`,
    `公的保障・配偶者収入・既存保険・貯蓄を差し引いた不足額: ${shortfall.toFixed(1)}万円`,
  ];

  return {
    key: 'disability',
    label: '就業不能',
    score,
    level: 'low',
    reasons,
    gap: { requiredAmount, publicCoverage: publicCoverage + spouseCoverage, ownAssets, existingInsurance: existingCoverageValue, shortfall },
  };
}
