// Quick Match(LINE等で受け取った案件文・要員スキルシートをそのまま貼り付けて
// 即座に構造化・マッチングする機能)の中核ロジック。既存のGmail取り込み経路
// (parseEmail/detectEmailType/parseProjectCandidate/parseEngineerCandidate)を
// そのまま再利用し、ここでは「メールではなく貼り付けテキストを対象にする」
// という違いのみを吸収する。新しい抽出ロジックはここでは一切実装しない。

import { validateEngineerRecord } from '../../intake/engineer';
import { validateProjectRecord } from '../../intake/project';
import type { EngineerRecord, ProjectRecord } from '../../intake/types';
import { detectEmailType, parseEmail, parseEngineerCandidate, parseProjectCandidate } from '../../parser/parseEmail';

/**
 * 自動判定(デフォルト)、または営業がその場で選べる小さなfallback selector。
 * 自動判定はdetectEmailType()の既存ロジックそのまま(重要語のスコア比較)
 * であり、貼り付けテキストにはメールの件名に相当する情報が無いため、件名
 * 込みの実メールより誤判定しやすい。そのため手動切り替えを用意する
 * (キーワードスコアのロジック自体は変更しない)。
 */
export type QuickMatchOverride = 'auto' | 'project' | 'engineer';

export type QuickMatchAnalysis =
  | { status: 'empty' }
  | { status: 'parse-failed' }
  | { status: 'validation-failed'; recordType: 'project' | 'engineer'; candidate: Record<string, unknown>; errors: string[] }
  | { status: 'ok'; recordType: 'project'; record: ProjectRecord }
  | { status: 'ok'; recordType: 'engineer'; record: EngineerRecord };

let quickMatchIdCounter = 0;

/** 貼り付けのたびに一意なidを振る(Workspaceの実データidとは名前空間を分ける)。
 * このidはQuick Matchのその場限りの解析結果を識別するためだけに使い、
 * 既存Workspace(validProjects/validEngineers)へは一切書き込まない。 */
function nextQuickMatchId(): string {
  quickMatchIdCounter += 1;
  return `quick-match-${Date.now()}-${quickMatchIdCounter}`;
}

/**
 * 貼り付けテキストを解析し、Project/Engineerとして構造化する。
 *
 * - override==='auto'の場合はparseEmail()をそのまま呼ぶ(件名は無いため空文字。
 *   既存のGmail取り込みと全く同じ判定・抽出ロジックを通る)。
 * - override==='project'/'engineer'の場合は、判定を営業の指定で固定し、
 *   対応するparseXxxCandidate()を直接呼ぶ(判定ロジック自体は変更しない、
 *   単に判定結果を上書きするだけ)。
 *
 * 抽出できたcandidateは既存のvalidateProjectRecord/validateEngineerRecordで
 * そのまま検証する(Quick Match専用の検証ルールは作らない)。
 */
export function analyzeQuickMatchText(rawText: string, override: QuickMatchOverride = 'auto'): QuickMatchAnalysis {
  const text = rawText.trim();
  if (!text) {
    return { status: 'empty' };
  }

  const id = nextQuickMatchId();
  let recordType: 'project' | 'engineer';
  let candidate: Record<string, unknown>;

  if (override === 'project') {
    recordType = 'project';
    candidate = parseProjectCandidate('', text, id);
  } else if (override === 'engineer') {
    recordType = 'engineer';
    candidate = parseEngineerCandidate('', text, id);
  } else {
    const detected = detectEmailType('', text);
    if (detected === null) {
      return { status: 'parse-failed' };
    }
    const parsed = parseEmail({ id, subject: '', bodyText: text });
    if (parsed.status !== 'parsed') {
      return { status: 'parse-failed' };
    }
    recordType = parsed.recordType;
    candidate = parsed.candidate;
  }

  if (recordType === 'project') {
    const validation = validateProjectRecord(candidate);
    if (!validation.valid) {
      return { status: 'validation-failed', recordType: 'project', candidate, errors: validation.errors };
    }
    return { status: 'ok', recordType: 'project', record: validation.value };
  }

  const validation = validateEngineerRecord(candidate);
  if (!validation.valid) {
    return { status: 'validation-failed', recordType: 'engineer', candidate, errors: validation.errors };
  }
  return { status: 'ok', recordType: 'engineer', record: validation.value };
}
