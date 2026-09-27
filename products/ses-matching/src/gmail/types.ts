// Gmail APIのレスポンス形状をそのままアプリ全体に流さないための最小内部型。
// parser/以降(そしてmatching層)はこの型だけを見て、Gmail API固有の型
// (googleapisのschema型)を一切知らない。

export interface RawEmail {
  id: string;
  threadId?: string;
  from?: string;
  subject?: string;
  date?: string;
  bodyText?: string;
}
