import type { RiskCategoryResult } from '../types/diagnosis';
import { KNOWLEDGE_BASE } from './knowledgeBase';
import type { KnowledgeSource, RagQuery, RetrievedSource } from './types';

/*
  検索(retrieval)は、この時点では埋め込み(embedding)やvector DBを使わない。
  knowledge baseは数十件規模であり、キーワード一致ベースの単純なスコアリングで
  十分に「関連する資料を取りこぼさず・出典付きで返す」ことができる。
  将来knowledge baseが大きくなった場合、この関数のシグネチャ(RagQuery → RetrievedSource[])
  を保ったまま、内部実装のみをembedding検索に差し替えられるようにしている。
*/

const SNIPPET_LENGTH = 120;

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

// クエリ文字列を検索語に分割する。日本語は形態素解析を行わず、
// 空白・句読点で区切った単語 + 元の文字列全体(部分一致用)を両方使う簡易実装。
function tokenize(text: string): string[] {
  const normalized = normalize(text);
  const words = normalized
    .split(/[\s、。・,.:;「」()（）]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  return Array.from(new Set([normalized, ...words]));
}

function scoreSource(source: KnowledgeSource, terms: string[]): number {
  if (terms.length === 0) return 0;
  const title = normalize(source.title);
  const content = normalize(source.content);
  const tags = source.tags.map(normalize);

  let score = 0;
  for (const term of terms) {
    if (term.length < 2) continue;
    if (title.includes(term)) score += 5;
    if (tags.some((t) => t.includes(term) || term.includes(t))) score += 4;
    if (content.includes(term)) score += 1;
  }
  return score;
}

function buildSnippet(content: string, terms: string[]): string {
  const normalizedContent = normalize(content);
  const hitTerm = terms.find((t) => t.length >= 2 && normalizedContent.includes(t));
  if (!hitTerm) return content.slice(0, SNIPPET_LENGTH) + (content.length > SNIPPET_LENGTH ? '…' : '');

  const idx = normalizedContent.indexOf(hitTerm);
  const start = Math.max(0, idx - 20);
  const end = Math.min(content.length, idx + SNIPPET_LENGTH);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return prefix + content.slice(start, end) + suffix;
}

/**
 * knowledge baseに対するキーワード検索。
 * 出典情報(sourceId/title/organization/url)を必ず伴う RetrievedSource[] を返す。
 * 一致する資料がなければ空配列を返す(存在しない情報を補って返すことはしない)。
 */
export function search(query: RagQuery): RetrievedSource[] {
  const terms = tokenize(query.text);
  const limit = query.limit ?? 3;

  const candidates = query.category
    ? KNOWLEDGE_BASE.filter((s) => s.category === query.category || s.category === 'general')
    : KNOWLEDGE_BASE;

  const scored = candidates
    .map((source) => ({ source, score: scoreSource(source, terms) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ source, score }) => ({
    sourceId: source.sourceId,
    title: source.title,
    organization: source.organization,
    url: source.url,
    category: source.category,
    snippet: buildSnippet(source.content, terms),
    score,
    effectiveDate: source.effectiveDate,
    retrievedDate: source.retrievedDate,
    version: source.version,
  }));
}

/**
 * 診断結果の1カテゴリ(RiskCategoryResult)について、関連する根拠資料を検索する。
 * クエリはカテゴリのラベルと判定理由(reasons)から組み立てる。
 * 診断エンジンの計算結果そのもの(score/level/gap)は一切参照・変更しない — 検索語の材料としてのみ使う。
 */
export function retrieveForCategory(category: RiskCategoryResult, limit = 3): RetrievedSource[] {
  const text = [category.label, ...category.reasons].join(' ');
  return search({ text, category: category.key, limit });
}

/**
 * KnowledgeSourceをRetrievedSourceへ変換する。evidenceMapping.ts が
 * (relatedReasonKeysの直接一致など)search()を経由しない独自のスコアリングで
 * 資料を採用する場合に、出典metadataの組み立てを共通化するためのヘルパー。
 * search()自体の挙動・戻り値は変更しない。
 */
export function toRetrievedSource(source: KnowledgeSource, score: number, highlightTerms: string[] = []): RetrievedSource {
  return {
    sourceId: source.sourceId,
    title: source.title,
    organization: source.organization,
    url: source.url,
    category: source.category,
    snippet: buildSnippet(source.content, highlightTerms.length > 0 ? highlightTerms : [source.title]),
    score,
    effectiveDate: source.effectiveDate,
    retrievedDate: source.retrievedDate,
    version: source.version,
  };
}
