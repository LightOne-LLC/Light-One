// 外部（メール本文、将来のCSV/API等）から受け取る案件・要員データの入力型。
//
// Scoring Engine(`../scoring`)が要求する `ProjectInput` / `EngineerInput` と
// フィールドはほぼ同じだが、複数件を識別するための `id` を持つ点が異なる。
// Scoring Engineは個々の計算に集中させたいため id を持たせず、
// 「どの案件/要員のデータか」を扱うのはこの入力層の責務とする。

import type { EngineerSkill, JapaneseLevel, RequiredSkill } from '../scoring/types';

export interface ProjectRecord {
  id: string;
  requiredSkills: RequiredSkill[];
  rateMin: number; // 万円/月
  rateMax: number; // 万円/月
  location: string; // 都道府県
  remoteAllowed: boolean;
  startDate: string; // YYYY-MM-DD
  japaneseLevel: JapaneseLevel;
}

export interface EngineerRecord {
  id: string;
  skills: EngineerSkill[];
  desiredRateMin: number;
  desiredRateMax: number;
  desiredLocations: string[];
  remoteDesired: boolean;
  availableFrom: string; // YYYY-MM-DD
  japaneseLevel: JapaneseLevel;
}

export type ValidationResult<T> = { valid: true; value: T } | { valid: false; errors: string[] };
