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
import type {
  DatePrecisionCounts,
  GmailBulkImportResult,
  GmailBulkMatchingSample,
  MatchingWorkspaceProject,
} from './types';

function emptyDatePrecisionCounts(): DatePrecisionCounts {
  return { day: 0, month: 0, immediate: 0, unknown: 0, missing: 0 };
}

/** Parser候補(validation前)の日付フィールド(startDate/availableFrom)の
 * precisionを集計用カウンタへ加算する。フィールド自体が存在しなければ
 * missingとして数える(「記載が無い」と「記載はあったが不明」を区別する)。 */
function addDatePrecision(counts: DatePrecisionCounts, candidate: Record<string, unknown>, field: string): void {
  const dateValue = candidate[field];
  if (typeof dateValue !== 'object' || dateValue === null || !('precision' in dateValue)) {
    counts.missing++;
    return;
  }
  const precision = (dateValue as { precision: unknown }).precision;
  if (precision === 'day' || precision === 'month' || precision === 'immediate' || precision === 'unknown') {
    counts[precision]++;
  } else {
    counts.missing++;
  }
}

// PWA起動時の自動取得・手動再取得ともに200件を標準の取得件数とする
// (営業デモでの案件・要員の母数を増やすための拡張。既存のbulk fetch/
// Parser/Validation/Matchingロジック自体は一切変更しない)。
export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 200;

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

/** Parser候補(validation前、型はunknown)からMatching Workspace表示用の
 * 最小限のview modelを組み立てる。validでもinvalidでも(欠けている項目が
 * あっても)そのまま組み立てられるよう、値の有無だけを見て安全に取り出す
 * (無い値を推測して埋めない)。 */
function buildWorkspaceProject(
  subject: string | undefined,
  candidate: Record<string, unknown>,
  validation: { valid: boolean; errors: string[] },
): MatchingWorkspaceProject {
  const requiredSkills = Array.isArray(candidate.requiredSkills) ? candidate.requiredSkills : [];
  const skills = requiredSkills
    .map((skill) => (skill && typeof skill === 'object' && 'name' in skill ? (skill as { name: unknown }).name : undefined))
    .filter((name): name is string => typeof name === 'string' && name.length > 0);

  const rateMin = typeof candidate.rateMin === 'number' ? candidate.rateMin : undefined;
  const rateMax = typeof candidate.rateMax === 'number' ? candidate.rateMax : undefined;
  const location = typeof candidate.location === 'string' ? candidate.location : undefined;
  const remoteAllowed = typeof candidate.remoteAllowed === 'boolean' ? candidate.remoteAllowed : undefined;
  const startDate =
    typeof candidate.startDate === 'object' && candidate.startDate !== null && 'precision' in candidate.startDate
      ? (candidate.startDate as MatchingWorkspaceProject['startDate'])
      : undefined;

  // 表示名はProjectRecordと同じ優先順位(案件名ラベル > 件名)を使う。
  // candidate.projectNameはParser側(parseEmail.ts)で既にこの優先順位・
  // サニタイズ済みの値として設定されているため、ここでは値の有無だけ見る
  // (ロジックを重複実装しない)。
  const projectName = typeof candidate.projectName === 'string' ? candidate.projectName : undefined;
  const sourceCompany = typeof candidate.sourceCompany === 'string' ? candidate.sourceCompany : undefined;
  const commercialFlow = typeof candidate.commercialFlow === 'string' ? candidate.commercialFlow : undefined;

  return {
    id: typeof candidate.id === 'string' ? candidate.id : '',
    title: projectName ?? subject,
    sourceCompany,
    commercialFlow,
    skills,
    rateMin,
    rateMax,
    location,
    remoteAllowed,
    startDate,
    validation: {
      valid: validation.valid,
      errors: Array.from(new Set(validation.errors.map(extractErrorField))),
    },
  };
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
 * 流して集計結果を返す。RawEmailの本文/fromはこの結果に一切含めない
 * (集計値、validation失敗のフィールド名別件数、Matching Workspace用の
 * 案件一覧(projects)とvalidation済みレコード(validProjects/validEngineers)
 * のみ)。案件のsubjectは案件名相当の表示用途として例外的にtitleへ含める
 * (PIIではないため)。
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
  const workspaceProjects: MatchingWorkspaceProject[] = [];
  const projectDatePrecision = emptyDatePrecisionCounts();
  const engineerDatePrecision = emptyDatePrecisionCounts();

  for (const email of emails) {
    const parsed = parseEmail(email);

    if (parsed.status === 'unparsed') {
      unparsedTotal++;
      continue;
    }

    if (parsed.recordType === 'project') {
      projectTotal++;
      addDatePrecision(projectDatePrecision, parsed.candidate, 'startDate');
      const validation = validateProjectRecord(parsed.candidate);
      if (validation.valid) {
        projectValid++;
        validProjects.push(validation.value);
        workspaceProjects.push(buildWorkspaceProject(email.subject, parsed.candidate, { valid: true, errors: [] }));
      } else {
        projectInvalid++;
        validation.errors.forEach((err) => addError(validationErrors, err));
        workspaceProjects.push(
          buildWorkspaceProject(email.subject, parsed.candidate, { valid: false, errors: validation.errors }),
        );
      }
      continue;
    }

    engineerTotal++;
    addDatePrecision(engineerDatePrecision, parsed.candidate, 'availableFrom');
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
    project: { total: projectTotal, valid: projectValid, invalid: projectInvalid, datePrecision: projectDatePrecision },
    engineer: {
      total: engineerTotal,
      valid: engineerValid,
      invalid: engineerInvalid,
      datePrecision: engineerDatePrecision,
    },
    unparsed: unparsedTotal,
    validationErrors,
    matching: {
      validProjects: validProjects.length,
      validEngineers: validEngineers.length,
      matchableProjects,
      sample,
    },
    // Matching Workspace用。projectsは valid/invalid 問わず全件、
    // validProjects/validEngineersは検証済みでそのままmatchProjectToEngineers()
    // へ渡せる既存の型(クライアント側でも既存Matching Engineをそのまま呼ぶ
    // だけで、scoringロジックはコピーしない)。
    projects: workspaceProjects,
    validProjects,
    validEngineers,
  };
}
