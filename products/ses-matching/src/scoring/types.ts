// スコアリングエンジンで扱う型定義。
// Firestoreのドキュメント形状とほぼ対応するが、スコアリング関数はFirestoreに
// 依存しない純粋なデータ型のみを受け取る（ユニットテストしやすくするため）。

export type JapaneseLevel = 'none' | 'N4' | 'N3' | 'N2' | 'N1' | 'business' | 'native';

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
  startDate: string; // YYYY-MM-DD
  japaneseLevel: JapaneseLevel;
}

export interface EngineerInput {
  skills: EngineerSkill[];
  desiredRateMin: number;
  desiredRateMax: number;
  desiredLocations: string[]; // 都道府県の配列（複数希望可）
  remoteDesired: boolean;
  availableFrom: string; // YYYY-MM-DD
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
