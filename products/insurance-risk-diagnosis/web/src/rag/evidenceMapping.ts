import type { RiskCategoryResult } from '../types/diagnosis';
import { KNOWLEDGE_BASE } from './knowledgeBase';
import { search, toRetrievedSource } from './retrieval';
import type { Evidence } from './types';

/*
  Evidence Mapping。

  単なるkeyword検索(retrieval.search)の一段上にあるレイヤーで、
  「診断結果の具体的なreasonが、どの資料によって裏付けられるか」を
  明示的に対応付ける。依存の向きは常に一方向:

    RiskCategoryResult(決定論的診断エンジンの出力・読み取り専用)
        ↓
    Evidence Mapping(このファイル)
        ↓
    Evidence[]

  逆方向(EvidenceがRiskCategoryResultを書き換える)は存在しない。

  2段階でEvidenceを組み立てる:
    1) direct  — KnowledgeSource.relatedReasonKeys が実際のreasons[]文字列に
                 部分一致する場合。診断エンジンが実際にその制度・前提を使って
                 計算したことを示す、最も確度の高い対応付け。
    2) related — directで埋まらなかった残り枠を、既存のkeyword検索(retrieval.search)
                 で補う。カテゴリ・ラベル的に関連はするが、reasons内に直接の
                 一致フレーズは無いことを 'related' というrelevanceで明示する。
*/

const DIRECT_MATCH_SCORE = 100;
const DEFAULT_LIMIT = 4;

function findDirectEvidence(category: RiskCategoryResult): Evidence[] {
  const candidates = KNOWLEDGE_BASE.filter(
    (s) => s.applicableRiskCategories.includes(category.key) && s.relatedReasonKeys.length > 0,
  );

  const evidence: Evidence[] = [];
  for (const source of candidates) {
    const matchedReason = category.reasons.find((reason) =>
      source.relatedReasonKeys.some((key) => reason.includes(key)),
    );
    if (!matchedReason) continue;

    const matchedKey = source.relatedReasonKeys.find((key) => matchedReason.includes(key)) ?? source.title;
    evidence.push({
      source: toRetrievedSource(source, DIRECT_MATCH_SCORE, [matchedKey]),
      matchedReason,
      relevance: 'direct',
      score: DIRECT_MATCH_SCORE,
    });
  }
  return evidence;
}

function findRelatedEvidence(category: RiskCategoryResult, excludeSourceIds: Set<string>, limit: number): Evidence[] {
  if (limit <= 0) return [];
  const text = [category.label, ...category.reasons].join(' ');
  const results = search({ text, category: category.key, limit: limit + excludeSourceIds.size });

  return results
    .filter((r) => !excludeSourceIds.has(r.sourceId))
    .slice(0, limit)
    .map((source) => ({
      source,
      matchedReason: category.label,
      relevance: 'related' as const,
      score: source.score,
    }));
}

/**
 * 診断結果の1カテゴリについて、Evidence(出典 + どのreasonに紐づくか + 確度)を組み立てる。
 * category(score/level/gap/reasons)は読み取り専用として扱い、一切変更しない。
 * 一致する資料が無ければ空配列を返す(存在しない根拠を作らない)。
 */
export function buildEvidenceForCategory(category: RiskCategoryResult, limit = DEFAULT_LIMIT): Evidence[] {
  const direct = findDirectEvidence(category);
  const remaining = Math.max(0, limit - direct.length);
  const related = findRelatedEvidence(category, new Set(direct.map((e) => e.source.sourceId)), remaining);
  return [...direct, ...related].slice(0, limit);
}

export function buildEvidenceForCategories(categories: RiskCategoryResult[], limit = DEFAULT_LIMIT): Map<RiskCategoryResult['key'], Evidence[]> {
  const map = new Map<RiskCategoryResult['key'], Evidence[]>();
  for (const category of categories) {
    map.set(category.key, buildEvidenceForCategory(category, limit));
  }
  return map;
}
