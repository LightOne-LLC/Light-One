export type RiskLevel = 'low' | 'mid' | 'high';
export type OccupationType = 'employee' | 'public_servant' | 'self_employed';
export type EducationCourse = 'all_public' | 'public_then_private_univ' | 'all_private';

export interface Child {
  currentAge: number;
}

export interface BasicInfo {
  age: number;
  gender: 'male' | 'female' | 'other';
  occupationType: OccupationType;
  occupationRisk: RiskLevel;
  annualIncome: number; // 万円
  hasSpouse: boolean;
  spouseAge?: number;
  spouseAnnualIncome?: number; // 万円。配偶者自身の収入(継続する前提で死亡・就業不能時の家計を補う)
  children: Child[];
  educationCourse: EducationCourse;
  monthlyLivingExpense?: number; // 万円/月。未入力の場合は年収に対する簡易割合で概算する
}

export interface AssetInfo {
  savings: number; // 現金・預金
  otherAssets: number; // 投資信託・株式等の投資性資産
  realEstateValue: number; // 自宅等の不動産評価額の目安(万円)
  hasMortgageLifeInsurance: boolean;
  mortgageBalance: number;
  otherLoanBalance: number; // 住宅ローン以外の借入残高(万円)
}

export interface ExistingInsurance {
  deathCoverage: number;
  hasMedicalCoverage: boolean;
  hasDisabilityCoverage: boolean;
  hasSavingsTypeCoverage: boolean;
  hasCancerCoverage: boolean;
  hasCareCoverage: boolean;
  hasPersonalPension: boolean;
  monthlyPremiumTotal: number; // 万円/月。現在加入中の保険料合計の目安
}

export interface HealthInfo {
  hasMedicalHistory: boolean;
}

export interface RetirementPlan {
  desiredRetirementAge: number;
  expectedSeverancePay: number; // 万円。退職金見込み額の目安
  desiredMonthlyLivingCost?: number; // 万円/月。老後生活費の希望額。未入力なら現役生活費から概算
}

export interface DiagnosisInput {
  basic: BasicInfo;
  asset: AssetInfo;
  existingInsurance: ExistingInsurance;
  health: HealthInfo;
  retirement: RetirementPlan;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export interface EducationCostBreakdownItem {
  childIndex: number;
  childAge: number;
  stage: string;
  amount: number;
}

export interface DeathCoverageResult {
  requiredAmount: number;
  grossNeed: number;
  riskScore: number;
  breakdown: {
    phaseALivingCost: number;
    phaseAYears: number;
    phaseBLivingCost: number;
    phaseBYears: number;
    educationTotal: number;
    educationBreakdown: EducationCostBreakdownItem[];
    funeralCost: number;
    mortgageAddOn: number;
    survivorPensionTotal: number;
    savings: number;
    otherAssets: number;
    existingDeathCoverage: number;
  };
  reasons: string[];
}

// 「必要額 / 公的保障 / 自己資産 / 既存の保険 / 不足額」を統一的に表現する構造。
// 死亡・老後・介護のように「必要な資金 vs 備え」の形で説明できるリスク領域で使う。
export interface RiskGap {
  requiredAmount: number;
  publicCoverage: number;
  ownAssets: number;
  existingInsurance: number;
  shortfall: number;
}

export type RiskLevelLabel = 'critical' | 'high' | 'medium' | 'low';
export type RiskCategoryKey = 'death' | 'medical' | 'disability' | 'retirement' | 'care' | 'asset' | 'inheritance';

export interface RiskCategoryResult {
  key: RiskCategoryKey;
  label: string;
  score: number; // 0-100。高いほど「現在の備えに対して不足・リスクが大きい」ことを示す
  level: RiskLevelLabel;
  reasons: string[];
  gap?: RiskGap;
}

export interface DiagnosisResult {
  overallScore: number;
  categories: RiskCategoryResult[];
  // 既存UI(CoverageBreakdown等)からの参照・過去データとの互換性のために個別のフィールドも維持する
  deathCoverage: DeathCoverageResult;
  medicalRisk: ScoreResult;
  disabilityRisk: ScoreResult;
  assetFormation: ScoreResult;
  suggestedProductTypes: string[];
  calculatedAt: string;
  assumptions: string[]; // 前提条件・制度適用時点の開示
}

export interface HistoryItem {
  id: string;
  createdAt: string;
  requiredDeathCoverage: number;
  overallScore: number;
  topRisks: { label: string; level: RiskLevelLabel }[];
  suggestedProductTypes: string[];
}

export function emptyDiagnosisInput(): DiagnosisInput {
  return {
    basic: {
      age: 30,
      gender: 'male',
      occupationType: 'employee',
      occupationRisk: 'low',
      annualIncome: 500,
      hasSpouse: false,
      spouseAge: undefined,
      spouseAnnualIncome: undefined,
      children: [],
      educationCourse: 'all_public',
      monthlyLivingExpense: undefined,
    },
    asset: {
      savings: 100,
      otherAssets: 0,
      realEstateValue: 0,
      hasMortgageLifeInsurance: true,
      mortgageBalance: 0,
      otherLoanBalance: 0,
    },
    existingInsurance: {
      deathCoverage: 0,
      hasMedicalCoverage: false,
      hasDisabilityCoverage: false,
      hasSavingsTypeCoverage: false,
      hasCancerCoverage: false,
      hasCareCoverage: false,
      hasPersonalPension: false,
      monthlyPremiumTotal: 0,
    },
    health: {
      hasMedicalHistory: false,
    },
    retirement: {
      desiredRetirementAge: 65,
      expectedSeverancePay: 0,
      desiredMonthlyLivingCost: undefined,
    },
  };
}

// 過去バージョンで保存された下書き・入力データは新フィールドを持たない場合があるため、
// 各セクションを既定値とマージして安全に補完する。
export function mergeWithDefaults(partial: Partial<DiagnosisInput> | null | undefined): DiagnosisInput {
  const defaults = emptyDiagnosisInput();
  if (!partial) return defaults;
  return {
    basic: { ...defaults.basic, ...partial.basic },
    asset: { ...defaults.asset, ...partial.asset },
    existingInsurance: { ...defaults.existingInsurance, ...partial.existingInsurance },
    health: { ...defaults.health, ...partial.health },
    retirement: { ...defaults.retirement, ...partial.retirement },
  };
}
