// PWAへ返す取り込み結果の型。RawEmailの本文(bodyText)は意図的に含めない
// フィールドだけで構成する — メール本文をブラウザへ渡さないための境界。

import type { EngineerRecord, ProjectRecord } from '../intake/types';
import type { DateValue } from '../scoring/types';

export interface GmailImportResult {
  success: boolean;
  messageId?: string;
  from?: string;
  subject?: string;
  date?: string;
  type?: 'project' | 'engineer' | 'unparsed';
  extractedFields?: string[];
  // 要員メールから抽出できたスキル名のみ(経験年数やその他の項目は含めない)。
  // PWAのEngineer取り込み結果表示のための最小限の値渡し。
  skillNames?: string[];
  // 要員メールから抽出できた希望単価(万円)。min===maxの場合は固定値を表す。
  rateRange?: { min: number; max: number };
  // 要員メールから抽出できた希望勤務地(BP-A形式では最寄駅相当)。
  locations?: string[];
  // 要員メールから抽出できたリモート希望可否(強いキーワードのみで判定、
  // 判定できない場合は含めない)。
  remoteDesired?: boolean;
  validation?: { valid: boolean; errors: string[] };
  topCandidate?: { engineerId: string; score: number };
  reason?: string;
}

// GET /api/gmail/fetch (複数件取得+集計)の結果型。個別メールのfrom/本文は
// 一切含めない(件数の集計とvalidation失敗理由の集計、Matching Workspace用
// の案件一覧・validation済みレコードのみ)。案件のsubjectのみ、案件名相当の
// 表示用途として例外的にtitleへ含める(PIIではないため)。engineerIdは
// RawEmailのGmail message id由来の不透明な識別子であり、氏名・メール
// アドレス等のPIIではない。
export interface GmailBulkImportResult {
  success: boolean;
  limit?: number;
  fetched?: number;
  project?: { total: number; valid: number; invalid: number; datePrecision: DatePrecisionCounts };
  engineer?: { total: number; valid: number; invalid: number; datePrecision: DatePrecisionCounts };
  unparsed?: number;
  // validationに失敗したフィールド名ごとの件数(例: { startDate: 31, rate: 5 })。
  // 個別メールがどれか、何が書かれていたかは一切含まない。
  validationErrors?: Record<string, number>;
  matching?: {
    validProjects: number;
    validEngineers: number;
    matchableProjects: number;
    sample?: GmailBulkMatchingSample;
  };
  // Matching Workspace用のview model。案件は valid/invalid を問わず全件含む
  // (一覧表示とvalidation状態の確認のため)。validProjects/validEngineersは
  // 既存のProjectRecord/EngineerRecordそのもの(validation済み)で、
  // クライアント側で既存のmatchProjectToEngineers()へそのまま渡せる
  // (matchingロジックはサーバー・クライアントどちらでも一切変更・再実装しない)。
  projects?: MatchingWorkspaceProject[];
  validProjects?: ProjectRecord[];
  validEngineers?: EngineerRecord[];
  reason?: string;
}

export interface GmailBulkMatchingSample {
  projectId: string;
  ranking: { engineerId: string; score: number }[];
}

// Matching Workspaceの案件一覧・validation状態表示用の最小限のview model。
// 個別メールのfrom/本文全文は含めない。subjectは案件名相当の表示用途のみ
// (PIIではないため件名自体は含めてよい)。validation.errorsはフィールド名
// のみ(gmailBulkImportApiの集計と同じextractErrorField()を通した短い名前)。
export interface MatchingWorkspaceProject {
  id: string;
  title?: string;
  skills: string[];
  rateMin?: number;
  rateMax?: number;
  location?: string;
  remoteAllowed?: boolean;
  startDate?: DateValue;
  validation: { valid: boolean; errors: string[] };
}

// 案件のstartDate/要員のavailableFromの精度分布。個別メールの値そのものは
// 含めず、件数の集計のみ(missing: 稼働時期に関するラベル自体が本文に
// 見つからずフィールドが存在しなかった件数)。
export interface DatePrecisionCounts {
  day: number;
  month: number;
  immediate: number;
  unknown: number;
  missing: number;
}
