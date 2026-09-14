// スコアリングエンジンで扱う型定義。
// Firestoreのドキュメント形状とほぼ対応するが、スコアリング関数はFirestoreに
// 依存しない純粋なデータ型のみを受け取る（ユニットテストしやすくするため）。

export type JapaneseLevel = 'none' | 'N4' | 'N3' | 'N2' | 'N1' | 'business' | 'native';

/**
 * 稼働時期の精度。実メールでは「2026年10月〜」のように月までしか
 * 分からない・「即日」のように暦日を伴わない・「10月〜」のように年すら
 * 不明といった記載が大半で、"YYYY-MM-DD"の1形式では表現できない。
 * 根拠のない精度の水増し(月しか分からないものをday扱いする等)を防ぐため、
 * 精度そのものを型で区別する。
 *
 *  - 'day': valueは"YYYY-MM-DD"(年月日が明確)
 *  - 'month': valueは"YYYY-MM"(年月は明確、日は不明。日を1日と推測しない)
 *  - 'immediate': 「即日」等の相対表現。valueは常に''(現在時刻に依存させない
 *    ため、具体的な暦日へは変換しない)
 *  - 'unknown': 日付らしい記載はあったが上記のいずれにも解決できない
 *    (例: 年が無い"10月〜"、複数月にまたがる"8月or9月〜")。valueは常に''
 */
export type DatePrecision = 'day' | 'month' | 'immediate' | 'unknown';

export interface DateValue {
  precision: DatePrecision;
  value: string;
}

export interface RequiredSkill {
  name: string;
  minYears: number;
  /** true: 必須スキル, false: 尚可(歓迎)スキル */
  required: boolean;
}

export interface EngineerSkill {
  name: string;
  years: number;
}

export interface ProjectInput {
  requiredSkills: RequiredSkill[];
  rateMin: number; // 万円/月
  rateMax: number; // 万円/月
  location: string; // 都道府県
  remoteAllowed: boolean;
  startDate: DateValue;
  japaneseLevel: JapaneseLevel;
}

export interface EngineerInput {
  skills: EngineerSkill[];
  desiredRateMin: number;
  desiredRateMax: number;
  desiredLocations: string[]; // 都道府県の配列（複数希望可）
  remoteDesired: boolean;
  availableFrom: DateValue;
  japaneseLevel: JapaneseLevel;
}

export interface ScoreWeights {
  skillWeight: number;
  rateWeight: number;
  locationWeight: number;
  timingWeight: number;
}

export interface ScoreBreakdown {
  skillScore: number; // 0-1
  rateScore: number; // 0-1
  locationScore: number; // 0-1
  timingScore: number; // 0-1
  weightsUsed: ScoreWeights;
}

export interface TotalScoreResult {
  totalScore: number; // 0-100
  breakdown: ScoreBreakdown;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  skillWeight: 0.4,
  rateWeight: 0.2,
  locationWeight: 0.2,
  timingWeight: 0.2,
};
