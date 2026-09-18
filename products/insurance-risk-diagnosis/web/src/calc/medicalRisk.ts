import type { DiagnosisInput, RiskCategoryResult } from '../types/diagnosis';
import { MEDICAL_AGE_SCORE_TABLE, MEDICAL_OCCUPATION_SCORE, MEDICAL_HISTORY_SCORE, ageBand } from './params';
import { highCostMedicalMonthlyCap, MEDICAL_HIGH_COST_MONTHS_ASSUMPTION, MEDICAL_EXTRA_COST_RATIO } from './publicSystemParams';

export function calcMedicalRisk(input: DiagnosisInput): RiskCategoryResult {
  const { basic, health, asset, existingInsurance } = input;
  const band = ageBand(basic.age);
  const ageScore = MEDICAL_AGE_SCORE_TABLE[band];
  const occupationScore = MEDICAL_OCCUPATION_SCORE[basic.occupationRisk];
  const historyScore = health.hasMedicalHistory ? MEDICAL_HISTORY_SCORE : 0;
  const baseScore = Math.min(100, ageScore + occupationScore + historyScore);

  // 高額療養費制度により、公的医療保険加入者の自己負担には所得区分ごとの月額上限がある。
  const monthlyCap = highCostMedicalMonthlyCap(basic.annualIncome);
  const monthlySelfPay = monthlyCap * (1 + MEDICAL_EXTRA_COST_RATIO); // 差額ベッド代等、高額療養費の対象外費用を上乗せ
  const requiredAmount = monthlySelfPay * MEDICAL_HIGH_COST_MONTHS_ASSUMPTION;
  const ownAssets = Math.min(asset.savings, requiredAmount);
  const existingCoverageValue = existingInsurance.hasMedicalCoverage ? requiredAmount * 0.6 : 0; // 医療保険加入時は自己負担の目安6割をカバーすると仮定
  const shortfall = Math.max(0, requiredAmount - ownAssets - existingCoverageValue);

  const coverageRatio = requiredAmount > 0 ? shortfall / requiredAmount : 0;
  const score = Math.min(100, Math.round(baseScore * 0.5 + coverageRatio * 50));

  const reasons = [
    `年齢区分(${band})による基礎リスク: ${ageScore}点`,
    `職業危険度(${basic.occupationRisk})による加点: ${occupationScore}点`,
    `既往歴: ${health.hasMedicalHistory ? 'あり' : 'なし'} → ${historyScore}点`,
    `高額療養費制度により、自己負担は月額上限(目安${monthlyCap.toFixed(2)}万円、年収${basic.annualIncome}万円の所得区分)までに抑えられる(既に下記の自己負担目安に反映済み)`,
    `差額ベッド代等の上乗せを含む自己負担目安: 月${monthlySelfPay.toFixed(2)}万円 × ${MEDICAL_HIGH_COST_MONTHS_ASSUMPTION}ヶ月 = ${requiredAmount.toFixed(1)}万円`,
    existingInsurance.hasMedicalCoverage
      ? `既存の医療保険で自己負担の約6割をカバーすると仮定: −${existingCoverageValue.toFixed(1)}万円`
      : '医療保険未加入のため、自己負担分は貯蓄のみで対応する前提',
    `貯蓄でカバーできる額: ${ownAssets.toFixed(1)}万円、残る不足額: ${shortfall.toFixed(1)}万円`,
  ];

  return {
    key: 'medical',
    label: '医療',
    score,
    level: 'low',
    reasons,
    gap: {
      requiredAmount,
      publicCoverage: 0,
      ownAssets,
      existingInsurance: existingCoverageValue,
      shortfall,
    },
  };
}
