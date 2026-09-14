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
  validation?: { valid: boolean; errors: string[] };
  topCandidate?: { engineerId: string; score: number };
  reason?: string;
}
