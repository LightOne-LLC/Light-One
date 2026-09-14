// PWAが呼ぶ複数件Gmail取り込みAPIのサーバー側実装(Node専用、ブラウザへは
// 絶対にバンドルされない — gmailImportApi.tsと同じ境界)。
//
// Gmail(src/gmail/) -> RawEmail[] -> Parser(src/parser/) -> 既存Validation
// (src/intake/) -> 既存Matching(src/matching/) を、複数件に対して繰り返し
// 呼び出して集計するだけで、これらのロジック自体は一切変更・再実装しない
// (performGmailImportと同じ既存関数を1件ずつに対して使う)。

import { validateEngineerRecord } from '../intake/engineer';
import { validateProjectRecord } from '../intake/project';
import type { EngineerRecord, ProjectRecord } from '../intake/types';
import { matchProjectToEngineers } from '../matching/matchProjectToEngineers';
import { authenticate, getGmailService, getMessage, listMessages } from '../gmail/client';
import { toRawEmail } from '../gmail/parseMessage';
import type { RawEmail } from '../gmail/types';
import { parseEmail } from '../parser/parseEmail';
import type { GmailBulkImportResult, GmailBulkMatchingSample } from './types';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/** ユーザー入力値をそのままGmail APIへ渡さないための境界。数値でない/0以下は
 * デフォルト値へ、上限を超える値はMAX_LIMITへ丸める(推測して補完しない —
 * 単に安全な範囲へ収めるだけ)。 */
export function clampLimit(rawLimit: unknown): number {
  const n = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/** "field: message" 形式のvalidationエラーから、集計用のフィールド名だけを
 * 取り出す("requiredSkills[0]: ..." は "requiredSkills" へまとめる)。 */
function extractErrorField(message: string): string {
  const field = message.split(':')[0] ?? message;
  return field.replace(/\[\d+\]$/, '');
}

function addError(counts: Record<string, number>, message: string): void {
  const field = extractErrorField(message);
  counts[field] = (counts[field] ?? 0) + 1;
}

const CONCURRENCY = 10;

/** listで得たmessage idを固定の並列数でバッチ取得する(Gmail APIへの
 * 過度な同時リクエストを避けるための最小限の配慮。リトライ/バックオフ等は
 * 今回のスコープ外)。 */
async function fetchMessagesInBatches(
  service: ReturnType<typeof getGmailService>,
  ids: string[],
): Promise<RawEmail[]> {
  const results: RawEmail[] = [];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const messages = await Promise.all(batch.map((id) => getMessage(service, id)));
    results.push(...messages.map(toRawEmail));
  }
  return results;
}

async function fetchRecentRawEmails(limit: number): Promise<RawEmail[]> {
  const auth = await authenticate();
  const service = getGmailService(auth);

  const messages = await listMessages(service, limit);
  const ids = messages.map((m) => m.id).filter((id): id is string => Boolean(id));
  return fetchMessagesInBatches(service, ids);
}

/**
 * Gmailの直近`limit`件(clamp後)を取得し、既存のParser/Validation/Matchingへ
 * 流して集計結果を返す。RawEmailの本文/from/subjectはこの結果に一切含めない
 * (集計値と、validation失敗のフィールド名別件数、可能ならマッチング
 * サンプル1件分のみ)。
 *
 * `fetchRawEmails`は差し替え可能(テストではsyntheticなRawEmail[]を返す
 * 関数を注入し、実Gmail/OAuthに触れずに動作を検証する)。
 */
export async function performGmailBulkImport(
  rawLimit: unknown = DEFAULT_LIMIT,
  fetchRawEmails: (limit: number) => Promise<RawEmail[]> = fetchRecentRawEmails,
): Promise<GmailBulkImportResult> {
  const limit = clampLimit(rawLimit);

  let emails: RawEmail[];
  try {
    emails = await fetchRawEmails(limit);
  } catch (err) {
    return { success: false, limit, reason: err instanceof Error ? err.message : 'Gmail fetch failed' };
  }

  let projectTotal = 0;
  let projectValid = 0;
  let projectInvalid = 0;
  let engineerTotal = 0;
  let engineerValid = 0;
  let engineerInvalid = 0;
  let unparsedTotal = 0;
  const validationErrors: Record<string, number> = {};
  const validProjects: ProjectRecord[] = [];
  const validEngineers: EngineerRecord[] = [];

  for (const email of emails) {
    const parsed = parseEmail(email);

    if (parsed.status === 'unparsed') {
      unparsedTotal++;
      continue;
    }

    if (parsed.recordType === 'project') {
      projectTotal++;
      const validation = validateProjectRecord(parsed.candidate);
      if (validation.valid) {
        projectValid++;
        validProjects.push(validation.value);
      } else {
        projectInvalid++;
        validation.errors.forEach((err) => addError(validationErrors, err));
      }
      continue;
    }

    engineerTotal++;
    const validation = validateEngineerRecord(parsed.candidate);
    if (validation.valid) {
      engineerValid++;
      validEngineers.push(validation.value);
    } else {
      engineerInvalid++;
      validation.errors.forEach((err) => addError(validationErrors, err));
    }
  }

  const matchableProjects = validEngineers.length > 0 ? validProjects.length : 0;
  let sample: GmailBulkMatchingSample | undefined;
  if (validProjects.length > 0 && validEngineers.length > 0) {
    const sampleProject = validProjects[0];
    const ranking = matchProjectToEngineers(sampleProject, validEngineers);
    sample = {
      projectId: sampleProject.id,
      ranking: ranking.map((r) => ({ engineerId: r.engineerId, score: r.score })),
    };
  }

  return {
    success: true,
    limit,
    fetched: emails.length,
    project: { total: projectTotal, valid: projectValid, invalid: projectInvalid },
    engineer: { total: engineerTotal, valid: engineerValid, invalid: engineerInvalid },
    unparsed: unparsedTotal,
    validationErrors,
    matching: {
      validProjects: validProjects.length,
      validEngineers: validEngineers.length,
      matchableProjects,
      sample,
    },
  };
}
