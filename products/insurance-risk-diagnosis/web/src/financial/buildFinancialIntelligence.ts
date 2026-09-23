import type { DiagnosisResult } from '../types/diagnosis';
import type { StructuredExplanation } from '../rag';
import { buildFinancialProfileSummary } from './buildFinancialProfileSummary';
import { compareSnapshots } from './compareSnapshots';
import { findMissingInformation } from './missingInformation';
import type { FinancialIntelligence, FinancialProfile, FinancialSnapshot } from './types';

const RISK_AREA_COUNT = 3;

/**
 * Personal Financial Intelligence(Phase 4最上位層)。
 *
 * 責務は「既に存在する事実・診断結果・根拠を1つの構造に統合すること」のみ。
 * LLMは使わず、新しい判断・総合スコア・推奨も生成しない。
 *
 *   FinancialProfile → FinancialProfileSummary(Balance Sheet / Cash Flow / Protection Gap)
 *   DiagnosisResult  → riskAreas(そのまま、再判定しない)
 *   history          → keyChanges(compareSnapshotsの結果、直前のsnapshotとの比較)
 *   evidence          → そのまま保持(rag/explanation.tsの出力をここで生成し直さない)
 */
export function buildFinancialIntelligence(
  profile: FinancialProfile,
  diagnosis: DiagnosisResult,
  history: FinancialSnapshot[],
  evidence: StructuredExplanation,
): FinancialIntelligence {
  const currentState = buildFinancialProfileSummary(profile, diagnosis);

  // historyは呼び出し側で新しい順(最新が先頭)にソート済みであることを前提とする。
  // 先頭が現在のsnapshot、2番目が直前のsnapshotであれば比較する。
  const [current, previous] = history;
  const keyChanges = current && previous ? compareSnapshots(previous, current) : [];

  return {
    currentState,
    keyChanges,
    riskAreas: diagnosis.categories.slice().sort((a, b) => b.score - a.score).slice(0, RISK_AREA_COUNT),
    protectionGaps: currentState.protection,
    retirementPosition: profile.retirement,
    inheritanceContext: profile.inheritance,
    missingInformation: findMissingInformation(profile),
    evidence,
  };
}
