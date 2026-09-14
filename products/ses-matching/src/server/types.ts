// PWAへ返す取り込み結果の型。RawEmailの本文(bodyText)は意図的に含めない
// フィールドだけで構成する — メール本文をブラウザへ渡さないための境界。

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

// GET /api/gmail/fetch (複数件取得+集計)の結果型。個別メールのfrom/subject/
// 本文は一切含めない — 件数の集計とvalidation失敗理由の集計(フィールド名の
// みで個別メールの内容は含めない)、および参考としてマッチング可能な場合の
// 1件分のサンプルランキング(engineerIdはRawEmailのGmail message id由来の
// 不透明な識別子であり、氏名・メールアドレス等のPIIではない)のみを返す。
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
  reason?: string;
}

export interface GmailBulkMatchingSample {
  projectId: string;
  ranking: { engineerId: string; score: number }[];
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
