import type { RawEmail } from './types';

// Gmail API `messages.get(format: 'full')` レスポンスのうち、実際に使う部分だけの最小型。
// googleapisのフル型を持ち込まず、このファイルの外にGmail API固有の形を漏らさない。
export interface GmailApiPart {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string };
  parts?: GmailApiPart[];
}

export interface GmailApiMessage {
  id?: string;
  threadId?: string;
  payload?: GmailApiPart & { headers?: { name?: string; value?: string }[] };
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function stripHtml(html: string): string {
  // 本格的なHTMLパーサーではない。<style>/<script>の中身ごと除去してから
  // タグを除去する最小限の実装(automation-engine側のPython実装と同じ方針)。
  const withoutStyleScript = html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return withoutStyleScript.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getHeader(headers: { name?: string; value?: string }[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
}

/**
 * Gmailメッセージのpayloadから本文を取り出す。text/plainを優先し、無ければ
 * text/htmlをタグ除去して使う。multipart/alternativeが一段ネストしている
 * ケース(添付ファイル付きなど)も一段だけ辿る。
 */
function extractBody(payload: GmailApiPart | undefined): string {
  if (!payload) return '';

  const mimeType = payload.mimeType ?? '';
  const bodyData = payload.body?.data;

  if (bodyData && mimeType === 'text/plain') {
    return decodeBase64Url(bodyData);
  }

  const parts = payload.parts ?? [];

  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return stripHtml(decodeBase64Url(part.body.data));
    }
  }

  if (bodyData && mimeType === 'text/html') {
    return stripHtml(decodeBase64Url(bodyData));
  }

  return '';
}

/** Gmail APIの生レスポンスを、アプリ内で使うRawEmailへ変換する純粋関数。ネットワークアクセスなし。 */
export function toRawEmail(message: GmailApiMessage): RawEmail {
  const headers = message.payload?.headers;
  return {
    id: message.id ?? '',
    threadId: message.threadId,
    from: getHeader(headers, 'From'),
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    bodyText: extractBody(message.payload),
  };
}
