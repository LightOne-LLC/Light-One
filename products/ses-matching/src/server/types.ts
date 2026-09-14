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
  validation?: { valid: boolean; errors: string[] };
  topCandidate?: { engineerId: string; score: number };
  reason?: string;
}
