import type {
  DiagnosisInput, DiagnosisResult, RiskCategoryResult, RiskLevelLabel, DeathCoverageResult,
} from '../types/diagnosis';
import { calcRequiredDeathCoverage } from './deathCoverage';
import { calcMedicalRisk } from './medicalRisk';
import { calcDisabilityRisk } from './disabilityRisk';
import { calcRetirementRisk } from './retirementRisk';
import { calcCareRisk } from './careRisk';
import { calcAssetRisk } from './assetRisk';
import { calcInheritanceRisk } from './inheritanceRisk';
import { suggestProductTypes } from './productSuggestion';
import { PUBLIC_SYSTEM_ASOF } from './publicSystemParams';

// スコア(0-100、高いほど「必要な備えに対して不足が大きい」)を4段階の優先度に変換する。
// 閾値は恣意的な演出ではなく、「不足割合が概ね何%以上か」の目安として固定している。
export function levelFromScore(score: number): RiskLevelLabel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function deathCategoryFrom(death: DeathCoverageResult): RiskCategoryResult {
  const b = death.breakdown;
  return {
    key: 'death',
    label: '死亡',
    score: Math.round(death.riskScore),
    level: levelFromScore(death.riskScore),
    reasons: death.reasons,
    gap: {
      requiredAmount: death.grossNeed,
      publicCoverage: b.survivorPensionTotal,
      ownAssets: b.savings + b.otherAssets,
      existingInsurance: b.existingDeathCoverage,
      shortfall: death.requiredAmount,
    },
  };
}

export function buildDiagnosisResult(input: DiagnosisInput): DiagnosisResult {
  const deathCoverage = calcRequiredDeathCoverage(input);
  const medical = calcMedicalRisk(input);
  const disability = calcDisabilityRisk(input);
  const retirement = calcRetirementRisk(input);
  const care = calcCareRisk(input);
  const asset = calcAssetRisk(input);
  const inheritance = calcInheritanceRisk(input);

  const death = deathCategoryFrom(deathCoverage);
  const categories: RiskCategoryResult[] = [death, medical, disability, retirement, care, asset, inheritance]
    .map((c) => ({ ...c, level: levelFromScore(c.score) }));

  const overallScore = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);

  const suggestedProductTypes = suggestProductTypes({
    deathCoverageRiskScore: death.score,
    medicalScore: medical.score,
    disabilityScore: disability.score,
    assetFormationScore: retirement.score,
    careScore: care.score,
    inheritanceScore: inheritance.score,
  });

  const assumptions = [
    `本診断は${PUBLIC_SYSTEM_ASOF}の公的制度をもとにした概算です。実際の制度・金額とは異なる場合があります。`,
    '特定の保険商品・保険会社を推奨するものではなく、保障の「種類」と大まかな過不足の目安を示すものです。',
    '相続・税務に関する内容は簡易チェックであり、個別の税務・法律相談の代替にはなりません。',
    '入力値をもとにした試算であり、実際のライフイベントや制度改正により結果は変動します。',
  ];

  return {
    overallScore,
    categories,
    deathCoverage,
    medicalRisk: { score: medical.score, reasons: medical.reasons },
    disabilityRisk: { score: disability.score, reasons: disability.reasons },
    assetFormation: { score: retirement.score, reasons: retirement.reasons },
    suggestedProductTypes,
    calculatedAt: new Date().toISOString(),
    assumptions,
  };
}
