import type { BasicInfo } from '../types/diagnosis';
import {
  LIVING_COST_RATIO, PHASE_A_RATIO, PHASE_B_RATIO, INDEPENDENCE_AGE, SPOUSE_LIFE_EXPECTANCY,
} from './params';

export interface SurvivorLivingCostResult {
  annualLivingCost: number;
  phaseA: number;
  phaseAYears: number;
  phaseB: number;
  phaseBYears: number;
  spouseIncomeOffset: number;
  reasons: string[];
}

export function calcSurvivorLivingCost(basic: BasicInfo): SurvivorLivingCostResult {
  if (!basic.hasSpouse && basic.children.length === 0) {
    return {
      annualLivingCost: 0, phaseA: 0, phaseAYears: 0, phaseB: 0, phaseBYears: 0, spouseIncomeOffset: 0,
      reasons: ['配偶者・子供がいないため遺族生活費は発生しません。'],
    };
  }

  const baseLivingCost = basic.monthlyLivingExpense !== undefined
    ? basic.monthlyLivingExpense * 12
    : basic.annualIncome * LIVING_COST_RATIO;
  const reasons: string[] = basic.monthlyLivingExpense !== undefined
    ? [`年間生活費(入力値) = 月間生活費${basic.monthlyLivingExpense}万円 × 12ヶ月 = ${baseLivingCost.toFixed(1)}万円`]
    : [`年間生活費目安 = 年収${basic.annualIncome}万円 × ${LIVING_COST_RATIO * 100}% = ${baseLivingCost.toFixed(1)}万円`];

  const youngestChildAge = basic.children.length
    ? Math.min(...basic.children.map((c) => c.currentAge))
    : null;
  const phaseAYears = youngestChildAge !== null
    ? Math.max(0, INDEPENDENCE_AGE - youngestChildAge)
    : 0;
  const spouseIncome = basic.hasSpouse ? (basic.spouseAnnualIncome ?? 0) : 0;
  const phaseAGross = baseLivingCost * PHASE_A_RATIO * phaseAYears;
  const phaseA = Math.max(0, phaseAGross - spouseIncome * phaseAYears);
  if (phaseAYears > 0) {
    reasons.push(
      `末子独立(${INDEPENDENCE_AGE}歳)までの${phaseAYears}年間: ${baseLivingCost.toFixed(1)}万円 × ${PHASE_A_RATIO * 100}% × ${phaseAYears}年 = ${phaseAGross.toFixed(1)}万円`,
    );
    if (spouseIncome > 0) {
      reasons.push(`配偶者自身の収入(年収${spouseIncome}万円)を${phaseAYears}年分差し引き: −${(spouseIncome * phaseAYears).toFixed(1)}万円`);
    }
  }

  let phaseBYears = 0;
  let phaseB = 0;
  if (basic.hasSpouse && basic.spouseAge !== undefined) {
    const spouseAgeAtPhaseAEnd = basic.spouseAge + phaseAYears;
    phaseBYears = Math.max(0, SPOUSE_LIFE_EXPECTANCY - spouseAgeAtPhaseAEnd);
    const phaseBGross = baseLivingCost * PHASE_B_RATIO * phaseBYears;
    phaseB = Math.max(0, phaseBGross - spouseIncome * phaseBYears);
    if (phaseBYears > 0) {
      reasons.push(
        `末子独立後、配偶者${SPOUSE_LIFE_EXPECTANCY}歳までの${phaseBYears}年間: ${baseLivingCost.toFixed(1)}万円 × ${PHASE_B_RATIO * 100}% × ${phaseBYears}年 = ${phaseBGross.toFixed(1)}万円`,
      );
      if (spouseIncome > 0) {
        reasons.push(`配偶者自身の収入を${phaseBYears}年分差し引き: −${(spouseIncome * phaseBYears).toFixed(1)}万円`);
      }
    }
  }

  const spouseIncomeOffset = spouseIncome * (phaseAYears + phaseBYears);

  return { annualLivingCost: baseLivingCost, phaseA, phaseAYears, phaseB, phaseBYears, spouseIncomeOffset, reasons };
}
