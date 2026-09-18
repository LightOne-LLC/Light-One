// 公的保障制度の金額・料率パラメータ。
// 出典(2026年9月時点で確認): 厚生労働省「高額療養費制度」案内、全国健康保険協会(協会けんぽ)「傷病手当金」案内、
// 令和6年度(2024年度)障害年金額、介護保険の自己負担割合、国税庁 相続税の基礎控除。
// 制度は改定されるため、本モデルは「2024年度(令和6年度)時点の制度をもとにした概算」であることを
// 診断結果画面の前提条件に必ず明示する。将来の制度改定時はこのファイルのみ更新すればよい構造にしている。
export const PUBLIC_SYSTEM_ASOF = '2024年度(令和6年度)時点の制度';

// --- 高額療養費制度: 69歳以下、月あたり自己負担上限額(万円)。多数回該当・世帯合算・住民税非課税区分は考慮しない簡易モデル。
export const HIGH_COST_MEDICAL_CAP_TABLE: { minAnnualIncome: number; monthlyCap: number }[] = [
  { minAnnualIncome: 1160, monthlyCap: 25.26 }, // 年収約1160万円以上: 252,600円
  { minAnnualIncome: 770, monthlyCap: 16.74 }, // 年収約770〜1160万円: 167,400円
  { minAnnualIncome: 370, monthlyCap: 8.01 }, // 年収約370〜770万円: 80,100円
  { minAnnualIncome: 0, monthlyCap: 5.76 }, // 年収約370万円未満: 57,600円
];

export function highCostMedicalMonthlyCap(annualIncome: number): number {
  const tier = HIGH_COST_MEDICAL_CAP_TABLE.find((t) => annualIncome >= t.minAnnualIncome);
  return tier ? tier.monthlyCap : HIGH_COST_MEDICAL_CAP_TABLE[HIGH_COST_MEDICAL_CAP_TABLE.length - 1].monthlyCap;
}

export const MEDICAL_HIGH_COST_MONTHS_ASSUMPTION = 2; // 入院・高額治療が続く想定月数(目安)
export const MEDICAL_EXTRA_COST_RATIO = 0.3; // 差額ベッド代等、高額療養費の対象外となる費用の上乗せ割合目安

// --- 傷病手当金: 会社員・公務員(健康保険加入者)のみ対象。自営業(国民健康保険)は対象外。
export const SICK_LEAVE_BENEFIT_RATIO = 2 / 3; // 標準報酬日額に対する支給割合
export const SICK_LEAVE_BENEFIT_MAX_MONTHS = 18; // 支給期間: 通算1年6ヶ月

// --- 障害年金(令和6年度・2024年度額、簡易概算。子の加算・配偶者加給・等級差は簡略化)
export const DISABILITY_BASIC_PENSION_GRADE2_ANNUAL = 81.6; // 障害基礎年金2級(万円/年)。老齢基礎年金満額と同水準
export const DISABILITY_BASIC_PENSION_GRADE1_ANNUAL = 102.0; // 障害基礎年金1級(万円/年)
export const DISABILITY_EMPLOYEE_PENSION_RATE = 0.05; // 障害厚生年金(報酬比例部分)の簡易概算係数(遺族厚生年金と同水準の目安)

// --- 老齢年金(簡易概算。実際の報酬比例部分の計算式とは異なる目安値)
export const OLD_AGE_BASIC_PENSION_ANNUAL = 81.6; // 老齢基礎年金満額(万円/年)。自営業は基礎年金のみ
export const OLD_AGE_EMPLOYEE_PENSION_RATE = 0.15; // 老齢厚生年金(報酬比例部分)の簡易概算係数。年収×係数を上乗せ

// --- 介護保険: 自己負担割合は所得に応じ1〜3割。本モデルは最も一般的な1割を既定値とする。
export const CARE_SELF_PAY_RATIO = 0.1;
export const CARE_MONTHLY_COST_AVERAGE = 9; // 万円/月。自己負担の平均目安(生命保険文化センター調査等を参考にした概算)
export const CARE_ONE_TIME_COST_AVERAGE = 74; // 万円。住宅改修・介護用品購入等の一時費用目安
export const CARE_AVERAGE_PERIOD_YEARS = 5; // 平均介護期間の目安(年)
export const CARE_PUBLIC_COVERAGE_RATIO = 1 - CARE_SELF_PAY_RATIO; // 介護保険給付(公的保障)がカバーする割合の目安

// --- 相続税: 基礎控除 = 3,000万円 + 600万円 × 法定相続人数(2015年改正以降、金額は変更なし)
export const INHERITANCE_BASE_DEDUCTION = 3000; // 万円
export const INHERITANCE_DEDUCTION_PER_HEIR = 600; // 万円/人
