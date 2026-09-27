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
 * Two files this depends on, neither committed to Git (see .gitignore):
 *   - credentials.json (GMAIL_CREDENTIALS_PATH): the OAuth client secret
 *     downloaded once from Google Cloud Console (APIs & Services ->
 *     Credentials -> OAuth client ID -> Desktop app).
 *   - token.json (GMAIL_TOKEN_PATH): the cached user token, created on
 *     first successful consent. Delete it to force re-consent.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { authenticate as runLocalAuthFlow } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
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

/** OAuth entry point: returns an authorized client, running the browser
 * consent flow only if no usable cached token exists. */
export async function authenticate(): Promise<OAuth2Client> {
  const saved = await loadSavedCredentialsIfExist();
  if (saved) return saved;

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
