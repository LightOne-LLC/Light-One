import type { DiagnosisInput, DiagnosisResult, RiskCategoryKey, RiskGap } from '../types/diagnosis';
import type { FinancialProfile } from './types';

const GAP_CATEGORY_KEYS: RiskCategoryKey[] = ['death', 'medical', 'disability', 'retirement', 'care'];

/**
 * 既存のDiagnosisInput(ユーザー入力)とDiagnosisResult(決定論的診断エンジンの出力)から、
 * 「ある時点の金融状態」であるFinancialProfileを組み立てる純粋関数。
 *
 * 新しい入力フォーム・新しい計算は一切行わない。既存フィールドの読み替え・整理のみ。
 * DiagnosisInput/DiagnosisResultは読み取り専用として扱い、変更しない。
 */
export function buildFinancialProfile(input: DiagnosisInput, result: DiagnosisResult): FinancialProfile {
  const { basic, asset, existingInsurance, health, retirement } = input;

  const gapsByCategory: Partial<Record<RiskCategoryKey, RiskGap>> = {};
  for (const key of GAP_CATEGORY_KEYS) {
    const category = result.categories.find((c) => c.key === key);
    if (category?.gap) gapsByCategory[key] = category.gap;
  }

  return {
    household: {
      age: basic.age,
      gender: basic.gender,
      occupationType: basic.occupationType,
      occupationRisk: basic.occupationRisk,
      hasSpouse: basic.hasSpouse,
      spouseAge: basic.spouseAge,
      childrenCount: basic.children.length,
      childrenAges: basic.children.map((c) => c.currentAge),
      educationCourse: basic.educationCourse,
    },
    income: {
      annualIncome: basic.annualIncome,
      spouseAnnualIncome: basic.spouseAnnualIncome,
    },
    living: {
      monthlyLivingExpense: basic.monthlyLivingExpense,
      // 診断エンジン(deathCoverage.breakdown)が既に算出した値をそのまま転記する(再計算しない)
      educationCostRemaining: result.deathCoverage.breakdown.educationTotal,
    },
    assets: {
      savings: asset.savings,
      investments: asset.otherAssets,
      realEstateValue: asset.realEstateValue,
    },
    liabilities: {
      mortgageBalance: asset.mortgageBalance,
      hasMortgageLifeInsurance: asset.hasMortgageLifeInsurance,
      otherLoanBalance: asset.otherLoanBalance,
    },
    protection: {
      existingDeathCoverage: existingInsurance.deathCoverage,
      monthlyPremiumTotal: existingInsurance.monthlyPremiumTotal,
      coverageFlags: {
        medical: existingInsurance.hasMedicalCoverage,
        disability: existingInsurance.hasDisabilityCoverage,
        savingsType: existingInsurance.hasSavingsTypeCoverage,
        cancer: existingInsurance.hasCancerCoverage,
        care: existingInsurance.hasCareCoverage,
        personalPension: existingInsurance.hasPersonalPension,
      },
      gapsByCategory,
    },
    retirement: {
      desiredRetirementAge: retirement.desiredRetirementAge,
      expectedSeverancePay: retirement.expectedSeverancePay,
      desiredMonthlyLivingCost: retirement.desiredMonthlyLivingCost,
    },
    careDisability: {
      hasMedicalHistory: health.hasMedicalHistory,
      hasCareCoverage: existingInsurance.hasCareCoverage,
      hasDisabilityCoverage: existingInsurance.hasDisabilityCoverage,
    },
    inheritance: {
      estimatedEstateAssets: asset.savings + asset.otherAssets + asset.realEstateValue + existingInsurance.deathCoverage,
      estimatedLiabilities: asset.mortgageBalance + asset.otherLoanBalance,
    },
  };
}
