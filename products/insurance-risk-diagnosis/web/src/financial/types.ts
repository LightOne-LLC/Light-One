import type {
  BasicInfo, DiagnosisResult, EducationCourse, OccupationType, RiskCategoryKey, RiskGap, RiskLevel,
} from '../types/diagnosis';
import type { Evidence, StructuredExplanation } from '../rag';

/*
  Financial Profile / Snapshot / Intelligence の型定義。

  重要な原則(このファイル全体に適用される):
  - ここに定義する型・それを組み立てる関数は、既存の DiagnosisInput / DiagnosisResult を
    「読み取って再構成する」だけで、新しいスコア・判定・推定値を生成しない。
  - 診断エンジン(web/src/calc)が既に計算した値(RiskGap、reasons等)は
    そのまま参照する。同じ計算をここで再現しない。
  - 入力側で未入力(型レベルでoptional)の項目は、0で埋めたり推測したりせず
    `undefined`(Profile側)/'unknown'(Summary側の計算結果)として保持する。
*/

// --- Financial Profile: DiagnosisInput + DiagnosisResult から読み取れる「ある時点の金融状態」---

export interface HouseholdProfile {
  age: number;
  gender: BasicInfo['gender'];
  occupationType: OccupationType;
  occupationRisk: RiskLevel;
  hasSpouse: boolean;
  spouseAge?: number;
  childrenCount: number;
  childrenAges: number[];
  educationCourse: EducationCourse;
}

export interface IncomeProfile {
  annualIncome: number; // 万円/年。本人(必須入力)
  spouseAnnualIncome?: number; // 万円/年。配偶者がいても未入力の場合はundefined
}

export interface LivingProfile {
  monthlyLivingExpense?: number; // 万円/月。未入力の場合はundefined(診断エンジンは内部で概算するが、その概算値をここでは複製しない)
  // 教育費残り総額は診断エンジン(deathCoverage.breakdown)が既に算出した値をそのまま転記する(再計算しない)
  educationCostRemaining: number;
}

export interface AssetsProfile {
  savings: number;
  investments: number; // otherAssets
  realEstateValue: number;
}

export interface LiabilitiesProfile {
  mortgageBalance: number;
  hasMortgageLifeInsurance: boolean;
  otherLoanBalance: number;
}

export interface ProtectionCoverageFlags {
  medical: boolean;
  disability: boolean;
  savingsType: boolean;
  cancer: boolean;
  care: boolean;
  personalPension: boolean;
}

export interface ProtectionProfile {
  existingDeathCoverage: number;
  monthlyPremiumTotal: number;
  coverageFlags: ProtectionCoverageFlags;
  // DiagnosisResult.categories[].gap をそのまま参照する(死亡・医療・就業不能・老後・介護)。
  // gapを持たないカテゴリ(資産・相続)は含まれない。
  gapsByCategory: Partial<Record<RiskCategoryKey, RiskGap>>;
}

export interface RetirementProfile {
  desiredRetirementAge: number;
  expectedSeverancePay: number;
  desiredMonthlyLivingCost?: number;
}

export interface CareDisabilityProfile {
  hasMedicalHistory: boolean;
  hasCareCoverage: boolean;
  hasDisabilityCoverage: boolean;
}

export interface InheritanceProfile {
  // 資産合計(貯蓄+投資性資産+不動産+既存死亡保険金)。相続税の課税対象額そのものではない単純合算。
  estimatedEstateAssets: number;
  estimatedLiabilities: number; // 住宅ローン+その他借入
}

export interface FinancialProfile {
  household: HouseholdProfile;
  income: IncomeProfile;
  living: LivingProfile;
  assets: AssetsProfile;
  liabilities: LiabilitiesProfile;
  protection: ProtectionProfile;
  retirement: RetirementProfile;
  careDisability: CareDisabilityProfile;
  inheritance: InheritanceProfile;
}

// --- Financial Snapshot: 「ある時点の診断結果」+「その診断を生んだ金融状態」---

/** FinancialProfileのスキーマバージョン。フィールド追加・意味変更時にインクリメントする。 */
export const FINANCIAL_PROFILE_VERSION = '1.0';

export interface FinancialSnapshot {
  id: string;
  createdAt: string;
  /** 既存の決定論的診断結果。ここでは一切変更しない(Single Source of Truth) */
  diagnosis: DiagnosisResult;
  /** その診断を生んだ入力から読み取った金融状態 */
  profile: FinancialProfile;
  version: {
    /** 診断が前提とした公的制度の効力発生時点(publicSystemParams.tsのPUBLIC_SYSTEM_ASOFと同じ文字列) */
    diagnosis: string;
    /** FinancialProfileのスキーマバージョン */
    profile: string;
  };
}

// --- Snapshot比較 ---

export type FinancialChangeDirection = 'increased' | 'decreased' | 'unchanged' | 'changed';

export interface FinancialChange {
  key: string;
  label: string;
  previous: number | string | null;
  current: number | string | null;
  direction: FinancialChangeDirection;
  unit?: string;
}

// --- Financial Profile Summary(Phase 4) ---

export interface BalanceSheetView {
  assets: { cash: number; investments: number; realEstate: number; total: number };
  liabilities: { mortgage: number; otherDebt: number; total: number };
  netPosition: number;
}

/** 収入・生活費のいずれかが未入力の場合は 'unknown' とし、推測値で埋めない */
export interface CashFlowView {
  selfMonthlyIncome: number;
  spouseMonthlyIncome: number | 'unknown';
  monthlyLivingCost: number | 'unknown';
  monthlySurplus: number | 'unknown';
}

export interface ProtectionGapEntry {
  key: RiskCategoryKey;
  label: string;
  gap: RiskGap;
}

export interface ProtectionGapView {
  byCategory: ProtectionGapEntry[];
}

export interface FinancialProfileSummary {
  household: HouseholdProfile;
  cashFlow: CashFlowView;
  balanceSheet: BalanceSheetView;
  protection: ProtectionGapView;
  retirement: RetirementProfile;
  inheritance: InheritanceProfile;
  missingInformation: MissingInformationItem[];
}

// --- Missing Information ---

export type FinancialProfileCategory =
  | 'household' | 'income' | 'living' | 'assets' | 'liabilities'
  | 'protection' | 'retirement' | 'careDisability' | 'inheritance';

export interface MissingInformationItem {
  key: string;
  label: string;
  category: FinancialProfileCategory;
}

// --- Financial Intelligence(Phase 4 最上位層) ---

export interface FinancialIntelligence {
  currentState: FinancialProfileSummary;
  /** 直前のsnapshotとの比較。履歴が1件しかない場合は空配列 */
  keyChanges: FinancialChange[];
  /** スコア上位のリスク領域(DiagnosisResult.categoriesをそのまま参照、再判定しない) */
  riskAreas: DiagnosisResult['categories'];
  protectionGaps: ProtectionGapView;
  retirementPosition: RetirementProfile;
  inheritanceContext: InheritanceProfile;
  missingInformation: MissingInformationItem[];
  /** 既存RAG(rag/explanation.ts)の出力をそのまま保持する。ここで根拠を新たに生成しない */
  evidence: StructuredExplanation;
}

export type { Evidence };
