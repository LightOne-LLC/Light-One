import type { RiskCategoryResult } from '../../types/diagnosis';
import { buildEvidenceForCategories } from '../../rag';
import type { Evidence } from '../../rag';
import { Card, SectionHeader, Eyebrow } from '../ui';

/*
  RAG専用の小さなcomponent。
  既存のWhyPanel/PublicProtectionPanel/CoverageBreakdown/AssumptionsPanelは変更せず、
  「制度・根拠資料の出典」だけを独立した面として追加する。
  診断結果(score/level/gap/reasons)は一切変更せず、buildEvidenceForCategories()で
  読み取って表示するだけ。出典が見つからないカテゴリは表示せず、存在しない出典を作らない。

  単なるURL一覧にしないため、各出典について
    - タイトル(公式情報へのリンク)
    - 発行機関
    - 有効時点
    - なぜこの出典が表示されているか(この判定の計算に直接使われたのか、関連する制度なのか)
  を1行で示す。デザインはPR#40のPlatinum Silver × Midnight Navyのeditorial reportの
  トーンを踏襲し、色は新規に追加せず既存のrisk-low(確度の高さの強調)とink-faint(補足情報)のみを使う。
*/

function relevanceLabel(evidence: Evidence): string {
  return evidence.relevance === 'direct' ? 'この判定の計算に使用' : '関連する制度・前提';
}

function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const { source } = evidence;
  return (
    <li className="text-xs leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-navy hover:underline underline-offset-2 min-w-0"
        >
          {source.title}
        </a>
        <span
          className={`shrink-0 text-[10px] font-medium tracking-[0.02em] whitespace-nowrap ${
            evidence.relevance === 'direct' ? 'text-risk-low' : 'text-ink-faint'
          }`}
        >
          {relevanceLabel(evidence)}
        </span>
      </div>
      <p className="text-ink-faint mt-0.5">
        {source.organization} · {source.effectiveDate}
      </p>
    </li>
  );
}

export function EvidenceSourcesPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const evidenceByCategory = buildEvidenceForCategories(categories);
  const entries = categories
    .map((category) => ({ category, evidence: evidenceByCategory.get(category.key) ?? [] }))
    .filter((entry) => entry.evidence.length > 0);

  if (entries.length === 0) return null;

  return (
    <Card as="section" variant="quiet">
      <SectionHeader
        variant="compact"
        title="Sources(制度・根拠資料の出典)"
        aside={<span className="text-[11px] text-ink-faint tabular-nums">{entries.length}領域</span>}
      />
      <ul className="grid gap-y-5 sm:grid-cols-2 sm:gap-x-8">
        {entries.map(({ category, evidence }) => (
          <li key={category.key}>
            <Eyebrow className="mb-2">{category.label}リスク</Eyebrow>
            <ul className="space-y-2.5">
              {evidence.map((e) => (
                <EvidenceItem key={e.source.sourceId} evidence={e} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
