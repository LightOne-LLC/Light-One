// 外部（メール本文、将来のCSV/API等）から受け取る案件・要員データの入力型。
//
// Scoring Engine(`../scoring`)が要求する `ProjectInput` / `EngineerInput` と
// フィールドはほぼ同じだが、複数件を識別するための `id` を持つ点が異なる。
// Scoring Engineは個々の計算に集中させたいため id を持たせず、
// 「どの案件/要員のデータか」を扱うのはこの入力層の責務とする。

import type { DateValue, EngineerSkill, JapaneseLevel, RequiredSkill } from '../scoring/types';

export interface ProjectRecord {
  id: string;
  // 表示用の案件名(実メールの「案件名：」ラベル、無ければ件名から抽出)。
  // idは内部識別子として維持し、UI表示専用の名前とは明確に分離する。
  // 取得できなかった場合は未設定のままとし、UI側が内部IDでフォールバック
  // 表示する(このフィールド自体を推測で埋めない)。
  projectName?: string;
  requiredSkills: RequiredSkill[];
  rateMin: number; // 万円/月
  rateMax: number; // 万円/月
  location: string; // 都道府県
  remoteAllowed: boolean;
  startDate: DateValue;
  // 実メールでは日本語レベルが明記されないことが大半のため任意項目とする。
  // Scoring Engine自体はjapaneseLevelを一切参照しない(死んだフィールド)。
  // 未指定の場合、toProjectInput()が'none'へ正規化する。
  japaneseLevel?: JapaneseLevel;
}

export interface EngineerRecord {
  id: string;
  // 表示用の人材名(実メールの「氏名：」ラベル等から抽出)。idは内部識別子
  // として維持し、UI表示専用の名前とは明確に分離する。取得できなかった
  // 場合は未設定のままとし、UI側が内部IDでフォールバック表示する。
  engineerName?: string;
  skills: EngineerSkill[];
  desiredRateMin: number;
  desiredRateMax: number;
  desiredLocations: string[];
  remoteDesired: boolean;
  availableFrom: DateValue;
  // ProjectRecordと同様、実メールでは記載されないことが大半のため任意項目。
  // 未指定の場合、toEngineerInput()が'none'へ正規化する。
  japaneseLevel?: JapaneseLevel;
}

export type ValidationResult<T> = { valid: true; value: T } | { valid: false; errors: string[] };
