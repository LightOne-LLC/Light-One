import type { DiagnosisInput, RiskCategoryResult } from '../types/diagnosis';
import { INHERITANCE_BASE_DEDUCTION, INHERITANCE_DEDUCTION_PER_HEIR } from './publicSystemParams';

// 相続財産の規模と基礎控除の関係を大まかに把握するための簡易チェックであり、
// 個別の税務・法律相談の代替にはならない(実際の法定相続人・特例適用等はより複雑)。
export function calcInheritanceRisk(input: DiagnosisInput): RiskCategoryResult {
  const { basic, asset, existingInsurance } = input;

  // 法定相続人数の簡易推定: 配偶者の有無 + 子の人数(親・兄弟姉妹等のケースは考慮しない簡易モデル)
  const legalHeirsCount = (basic.hasSpouse ? 1 : 0) + basic.children.length;
  const baseDeduction = INHERITANCE_BASE_DEDUCTION + INHERITANCE_DEDUCTION_PER_HEIR * legalHeirsCount;

  const estateValue = asset.savings + asset.otherAssets + asset.realEstateValue + existingInsurance.deathCoverage
    - asset.mortgageBalance - asset.otherLoanBalance;
  const taxableEstate = Math.max(0, estateValue - baseDeduction);

  const score = estateValue <= 0 ? 0 : Math.min(100, Math.round((taxableEstate / Math.max(estateValue, 1)) * 100));

  const reasons = legalHeirsCount === 0
    ? ['配偶者・子の情報がないため、法定相続人数を推定できません(簡易モデルの対象外)。']
    : [
        `推定相続財産: 資産合計(貯蓄+投資性資産+不動産+死亡保険金) − 負債 = ${estateValue.toFixed(1)}万円`,
        `法定相続人数(簡易推定、配偶者+子の人数): ${legalHeirsCount}人`,
        `相続税の基礎控除: ${INHERITANCE_BASE_DEDUCTION}万円 + ${INHERITANCE_DEDUCTION_PER_HEIR}万円 × ${legalHeirsCount}人 = ${baseDeduction.toFixed(1)}万円`,
        taxableEstate > 0
          ? `基礎控除を超える課税対象額の目安: ${taxableEstate.toFixed(1)}万円(相続税が発生する可能性があります)`
          : '推定相続財産は基礎控除の範囲内であり、相続税が発生する可能性は低いと考えられます。',
        '※法定相続人の範囲(親・兄弟姉妹等)や各種特例は考慮していない簡易チェックです。実際の申告要否は税理士等にご確認ください。',
      ];

  return {
    key: 'inheritance',
    label: '相続',
    score,
    level: 'low',
    reasons,
  };
}
