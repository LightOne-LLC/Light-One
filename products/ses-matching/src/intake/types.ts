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
  // 案件を出している会社(自己紹介文等から抽出)。要員情報を送信してきた
  // 会社(EngineerRecord.companyName)とは意味が異なるため、意図的に
  // 別フィールドとする(同じ名前にしない)。取得できなければ未設定。
  sourceCompany?: string;
  // 商流。実メールに書かれている表現をそのまま保持する自由テキスト
  // (例: "貴社まで" "現場→弊社")。構造化・推測は行わない。
  commercialFlow?: string;
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
  // その要員情報を送信してきた会社名(本文冒頭の名乗り・署名等、送信元を
  // 明確に示す情報からのみ抽出する)。「要員本人の所属会社」を推測する
  // フィールドではない — 実メール調査で、要員本人の所属先を明示する専用
  // ラベルは存在しないことを確認済み。案件を出している会社
  // (ProjectRecord.sourceCompany)とは意味が異なるため、意図的に別
  // フィールドとする(同じ名前にしない)。取得できなければ未設定
  // (根拠なく会社名を生成しない)。
  companyName?: string;
  // 商流・契約形態。実メールに書かれている表現をそのまま保持する自由
  // テキスト(例: "弊社個人事業主" "弊社フリーランス" "サクシード株式会社
  // 社員")。構造化・推測は行わない。「所属：」ラベルの値は、実メール
  // 調査(500件・要員134件)で98%以上がこの契約形態の記述であり、会社名
  // ではなかったため、companyNameへは使わずこちらへ集約する。
  commercialFlow?: string;
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
