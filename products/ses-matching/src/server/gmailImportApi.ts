// PWAが呼ぶ唯一のGmail取り込みAPIのサーバー側実装(Node専用、ブラウザへは
// 絶対にバンドルされない — vitePlugin.ts の configureServer/configurePreviewServer
// フック内でのみ実行される)。
//
// Gmail(src/gmail/) -> RawEmail -> Parser(src/parser/) -> 既存Validation
// (src/intake/) -> 既存Matching(src/matching/) を呼び出してつなぐだけで、
// これらのロジック自体は一切変更・再実装しない。

import { dummyEngineers } from '../demo/dummyData';
import { validateEngineerRecord } from '../intake/engineer';
import { validateProjectRecord } from '../intake/project';
import { matchProjectToEngineers } from '../matching/matchProjectToEngineers';
import { authenticate, getGmailService, getMessage, listMessages } from '../gmail/client';
import { toRawEmail } from '../gmail/parseMessage';
import type { RawEmail } from '../gmail/types';
import { parseEmail } from '../parser/parseEmail';
import type { ValidationResult } from '../intake/types';
import type { GmailImportResult } from './types';

function toValidationSummary(result: ValidationResult<unknown>): { valid: boolean; errors: string[] } {
  if (result.valid) return { valid: true, errors: [] };
  return { valid: false, errors: result.errors };
}

async function fetchLatestRawEmail(): Promise<RawEmail | null> {
  const auth = await authenticate();
  const service = getGmailService(auth);

  const messages = await listMessages(service, 1);
  if (messages.length === 0 || !messages[0].id) return null;

  const message = await getMessage(service, messages[0].id);
  return toRawEmail(message);
}

/**
 * Gmailの最新1通を取得し、Parser/Validation/(該当すれば)Matchingまで通した
 * 安全な要約結果を返す。RawEmailの本文はこの結果に含めない。
 *
 * `fetchRawEmail`は差し替え可能(テストではsyntheticなRawEmailを返す関数を
 * 注入し、実Gmail/OAuthに触れずに動作を検証する)。
 */
export async function performGmailImport(
  fetchRawEmail: () => Promise<RawEmail | null> = fetchLatestRawEmail,
): Promise<GmailImportResult> {
  let email: RawEmail | null;
  try {
    email = await fetchRawEmail();
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : 'Gmail fetch failed' };
  }

  if (!email) {
    return { success: false, reason: 'mailbox is empty' };
  }

  const base = {
    success: true as const,
    messageId: email.id,
    from: email.from,
    subject: email.subject,
    date: email.date,
  };

  const parsed = parseEmail(email);

  if (parsed.status === 'unparsed') {
    return { ...base, type: 'unparsed', reason: parsed.reason };
  }

  const extractedFields = Object.keys(parsed.candidate).filter((key) => key !== 'id');

  if (parsed.recordType === 'project') {
    const validation = validateProjectRecord(parsed.candidate);
    const result: GmailImportResult = {
      ...base,
      type: 'project',
      extractedFields,
      validation: toValidationSummary(validation),
    };
    if (validation.valid) {
      const matches = matchProjectToEngineers(validation.value, dummyEngineers);
      if (matches[0]) {
        result.topCandidate = { engineerId: matches[0].engineerId, score: matches[0].score };
      }
    }
    return result;
  }

  const validation = validateEngineerRecord(parsed.candidate);
  return {
    ...base,
    type: 'engineer',
    extractedFields,
    validation: toValidationSummary(validation),
  };
}
