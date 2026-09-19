import type { RiskCategoryKey } from '../types/diagnosis';
import { search } from './retrieval';
import type { ActionEvidence } from './types';

/*
  SuggestedActions(lib/nextSteps.tsのNEXT_STEPS)の各アクション文について、
  関連する出典を検索する。NEXT_STEPS自体の内容・優先順位・診断ロジックは
  一切変更しない — 既存の決定論的な配列をそのまま読み取り、各アクション文を
  検索クエリとして使うだけの追加レイヤー。
*/
const ACTION_EVIDENCE_LIMIT = 2;

export function buildActionEvidence(
  categoryKey: RiskCategoryKey,
  actions: string[],
  limit = ACTION_EVIDENCE_LIMIT,
): ActionEvidence[] {
  return actions.map((action) => ({
    action,
    sources: search({ text: action, category: categoryKey, limit }),
  }));
}
