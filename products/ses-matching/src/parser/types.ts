// Parser(RawEmail -> ProjectRecord/EngineerRecordの候補)の結果型。
// candidateはvalidateProjectRecord/validateEngineerRecordにそのまま渡す
// 「unknown」相当のオブジェクト。抽出できなかったフィールドはキー自体を
// 含めない(=undefined推測で埋めない)。実際の正当性チェックは既存の
// validateProjectRecord/validateEngineerRecordに委譲する。

export type ParsedEmailResult =
  | { status: 'parsed'; recordType: 'project'; candidate: Record<string, unknown> }
  | { status: 'parsed'; recordType: 'engineer'; candidate: Record<string, unknown> }
  | { status: 'unparsed'; reason: string };
