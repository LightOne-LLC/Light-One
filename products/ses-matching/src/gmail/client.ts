/**
 * Gmail API client (OAuth "installed app" flow), mirroring the existing
 * Python client at ai/automation-engine/app/gmail_client.py — same
 * read-only scope, same credentials.json/token.json pattern, same
 * "fetch a single message" scope for this round. Implemented natively
 * in TypeScript so SES Matching doesn't need to shell out to a
 * different-language process for something this small.
 *
 * OAuth ("installed app" flow via @google-cloud/local-auth):
 *
 *   Gmail account -> OAuth consent (browser) -> access/refresh token -> Gmail API
 *
 * Two files this depends on locally, neither committed to Git (see
 * .gitignore):
 *   - credentials.json (GMAIL_CREDENTIALS_PATH): the OAuth client secret
 *     downloaded once from Google Cloud Console (APIs & Services ->
 *     Credentials -> OAuth client ID -> Desktop app).
 *   - token.json (GMAIL_TOKEN_PATH): the cached user token, created on
 *     first successful consent. Delete it to force re-consent.
 *
 * In a serverless environment (no persistent filesystem, no browser to
 * complete a consent screen in) these files don't apply. There,
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN env vars
 * are used instead — same OAuth client, just already-granted credentials
 * supplied directly instead of read from disk.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { authenticate as runLocalAuthFlow } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { toRawEmail, type GmailApiMessage } from './parseMessage';
import type { RawEmail } from './types';

// Read-only on purpose — this client never sends, deletes, or modifies mail.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH ?? 'credentials.json';
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH ?? 'token.json';

const GMAIL_USER_ID = 'me';

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch {
    return null;
  }
}

async function saveCredentials(client: OAuth2Client): Promise<void> {
  const content = await readFile(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed ?? keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await writeFile(TOKEN_PATH, payload);
}

/** Builds a client directly from already-granted credentials supplied via
 * env vars, with no filesystem access — the path used in serverless
 * environments. Returns null if any of the three vars is missing. */
function credentialsFromEnv(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/** OAuth entry point: returns an authorized client. Prefers env-var
 * credentials (serverless-safe, no filesystem access); falls back to the
 * local credentials.json/token.json flow, running the browser consent
 * screen only if no usable cached token exists there either. In an
 * environment with no filesystem/browser access and no env credentials,
 * fails fast with a clear message instead of hanging on a consent flow
 * that can't complete. */
export async function authenticate(): Promise<OAuth2Client> {
  const fromEnv = credentialsFromEnv();
  if (fromEnv) return fromEnv;

  const saved = await loadSavedCredentialsIfExist();
  if (saved) return saved;

  if (process.env.VERCEL) {
    throw new Error(
      'Gmail credentials are not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.',
    );
  }

  const client = await runLocalAuthFlow({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

export function getGmailService(auth: OAuth2Client) {
  return google.gmail({ version: 'v1', auth });
}

/** Returns the authenticated mailbox's own address — useful to confirm
 * which account a run actually authenticated as before touching any mail. */
export async function getAccountEmail(service: ReturnType<typeof getGmailService>): Promise<string | undefined> {
  const res = await service.users.getProfile({ userId: GMAIL_USER_ID });
  return res.data.emailAddress ?? undefined;
}

/** Lists message id/threadId pairs (not full messages). No pagination
 * beyond a single page — large-scale sync is out of scope this round. */
export async function listMessages(
  service: ReturnType<typeof getGmailService>,
  maxResults = 1,
): Promise<{ id?: string | null; threadId?: string | null }[]> {
  const res = await service.users.messages.list({ userId: GMAIL_USER_ID, maxResults });
  return res.data.messages ?? [];
}

export async function getMessage(
  service: ReturnType<typeof getGmailService>,
  messageId: string,
): Promise<GmailApiMessage> {
  const res = await service.users.messages.get({ userId: GMAIL_USER_ID, id: messageId, format: 'full' });
  return res.data as GmailApiMessage;
}

/** Gmailのafter:検索演算子はアカウントのローカル日(day)単位の比較であり、
 * 正確な時刻の比較ではない。JST(UTC+9、DSTなし)前提でその暦日を求める。 */
function toJstDateQuery(ms: number): string {
  const jst = new Date(ms + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * `sinceMs`以降の全メッセージのid/threadIdを、ページネーションを正しく
 * 処理して(500件で打ち切らず)取得する。after:は暦日単位の比較のため、
 * 取りこぼしを避けて1日分手前から問い合わせる — 正確な`sinceMs`との
 * 突き合わせ(未来日時・対象期間外の除外含む)は呼び出し側がinternalDate
 * で行う(このリストAPI自体はid/threadIdしか返さないため)。
 *
 * listMessages()とは別関数として追加しており、その既存の挙動
 * (getLatestEmail()向けの単一ページ取得)には一切影響しない。
 */
export async function listMessageIdsSince(
  service: ReturnType<typeof getGmailService>,
  sinceMs: number,
): Promise<{ id?: string | null; threadId?: string | null }[]> {
  const q = `after:${toJstDateQuery(sinceMs - 24 * 60 * 60 * 1000)}`;

  const results: { id?: string | null; threadId?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await service.users.messages.list({
      userId: GMAIL_USER_ID,
      q,
      maxResults: 500,
      pageToken,
    });
    results.push(...(res.data.messages ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return results;
}

// Gmail API専用のバッチHTTPエンドポイント(汎用の www.googleapis.com/batch
// とは別物で、こちらはGmail向けに現在も提供されている)。1件ずつ
// messages.get()をHTTP往復していた既存方式に対し、複数件を1回のHTTP
// リクエストにまとめることで往復回数(レイテンシの支配的要因)を削減する。
const GMAIL_BATCH_URL = 'https://www.googleapis.com/batch/gmail/v1';
// 1バッチに含めるmessages.get呼び出し数。Gmail APIの公式ガイドは1バッチ
// 最大50件までを許容するが、実測の結果、バッチ内の各呼び出しも
// 「ユーザーあたりの同時リクエスト数」制限(429 rateLimitExceeded)の対象に
// なることを確認した — 50件バッチ×複数バッチ並行では大部分が429/403で
// 失敗した。既存の単発取得方式で実績のある同時実行数(10)と同じ実効
// 同時実行数に収まるよう、バッチサイズを10、バッチ同時実行数を1(完全に
// 逐次)にしている。これにより、往復回数はCONCURRENCY=10のバッチ単位分
// (10件ずつ)削減しつつ、Gmail側の同時実行数制限は従来と同じ水準に保つ。
const BATCH_SIZE = 10;
const BATCH_CONCURRENCY = 1;

interface BatchResponsePart {
  status: number;
  body: string;
}

function buildBatchRequestBody(ids: string[], boundary: string): string {
  let body = '';
  for (const id of ids) {
    body += `--${boundary}\r\n`;
    body += `Content-Type: application/http\r\n`;
    body += `Content-ID: <item-${id}>\r\n\r\n`;
    body += `GET /gmail/v1/users/me/messages/${id}?format=full\r\n\r\n`;
  }
  body += `--${boundary}--`;
  return body;
}

/** multipart/mixedのバッチレスポンスを、パートごとのHTTPステータスと
 * 本文(JSON文字列)へ分解する。Content-IDでの突き合わせは行わない
 * (各パートのJSON自体にmessageのidが含まれるため不要)。 */
function parseBatchResponse(responseText: string, boundary: string): BatchResponsePart[] {
  const rawParts = responseText.split(`--${boundary}`);
  const parts: BatchResponsePart[] = [];
  for (const raw of rawParts) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '--') continue;
    const statusMatch = trimmed.match(/HTTP\/1\.1 (\d+)/);
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (!statusMatch || jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) continue;
    parts.push({ status: Number(statusMatch[1]), body: trimmed.slice(jsonStart, jsonEnd + 1) });
  }
  return parts;
}

/** 最大BATCH_SIZE件のmessageを1回のバッチHTTPリクエストで取得する。
 * 個別messageの取得が失敗した場合(削除済み・一時的エラー等、HTTP
 * ステータスが200以外、またはJSONとして解釈できない場合)はそのmessageだけ
 * を黙ってスキップし、バッチ全体や他のmessageの取得は失敗させない。 */
async function fetchMessageBatch(auth: OAuth2Client, ids: string[]): Promise<GmailApiMessage[]> {
  const accessToken = (await auth.getAccessToken()).token;
  if (!accessToken) throw new Error('failed to obtain access token for Gmail batch request');

  const boundary = `batch_${Math.random().toString(36).slice(2)}`;
  const res = await fetch(GMAIL_BATCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
    },
    body: buildBatchRequestBody(ids, boundary),
  });

  if (!res.ok) {
    throw new Error(`Gmail batch request failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const responseBoundary = contentType.match(/boundary=([^;]+)/)?.[1]?.trim();
  if (!responseBoundary) {
    throw new Error('Gmail batch response is missing a multipart boundary');
  }

  const parts = parseBatchResponse(await res.text(), responseBoundary);
  const messages: GmailApiMessage[] = [];
  for (const part of parts) {
    if (part.status !== 200) continue;
    try {
      messages.push(JSON.parse(part.body) as GmailApiMessage);
    } catch {
      continue;
    }
  }
  return messages;
}

/**
 * 複数messageをGmail APIのバッチHTTPエンドポイント経由でまとめて取得する。
 * getMessage()を件数分個別に呼ぶ既存方式と返り値の内容(internalDate含む)
 * は同一で、HTTP往復の回数だけを削減する。
 *
 * BATCH_SIZE件ごとに分割し、BATCH_CONCURRENCY件のバッチリクエストを
 * 並行実行する。個別messageの取得失敗は該当messageだけをスキップし、
 * 全体やその他のmessage取得を巻き込まない(fetchMessageBatch参照)。
 */
export async function getMessagesBatch(auth: OAuth2Client, ids: string[]): Promise<GmailApiMessage[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    chunks.push(ids.slice(i, i + BATCH_SIZE));
  }

  const results: GmailApiMessage[] = [];
  for (let i = 0; i < chunks.length; i += BATCH_CONCURRENCY) {
    const group = chunks.slice(i, i + BATCH_CONCURRENCY);
    const groupResults = await Promise.all(group.map((chunk) => fetchMessageBatch(auth, chunk)));
    for (const r of groupResults) results.push(...r);
  }
  return results;
}

/**
 * Fetches exactly the single most recent message in the mailbox.
 * No search query/filtering, no pagination — "give me the newest
 * message" is the whole scope this round. Returns null on an empty
 * mailbox.
 */
export async function getLatestEmail(): Promise<RawEmail | null> {
  const auth = await authenticate();
  const service = getGmailService(auth);

  const messages = await listMessages(service, 1);
  if (messages.length === 0 || !messages[0].id) return null;

  const message = await getMessage(service, messages[0].id);
  return toRawEmail(message);
}
