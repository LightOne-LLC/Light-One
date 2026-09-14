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
