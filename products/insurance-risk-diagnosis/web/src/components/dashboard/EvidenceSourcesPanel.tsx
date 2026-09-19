import type { RiskCategoryResult } from '../../types/diagnosis';
import { explainCategories } from '../../rag';
import { Card, SectionHeader, Eyebrow } from '../ui';

/*
  RAG専用の小さなcomponent。
  既存のWhyPanel/PublicProtectionPanel/CoverageBreakdown/AssumptionsPanelは変更せず、
  「制度・保障・診断根拠の出典」だけを独立した面として追加する。
  診断結果(score/level/gap/reasons)は一切変更せず、explainCategories()で
  読み取って表示するだけ。出典が見つからないカテゴリはその旨を明示し、存在しない出典を作らない。
*/
export function EvidenceSourcesPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const explanations = explainCategories(categories).filter((e) => e.hasSupportingSource);
  if (explanations.length === 0) return null;

  return (
    <Card as="section" variant="quiet">
      <SectionHeader
        variant="compact"
        title="Sources(制度・根拠資料の出典)"
        aside={<span className="text-[11px] text-ink-faint tabular-nums">{explanations.length}領域</span>}
      />
      <ul className="grid gap-y-4 sm:grid-cols-2 sm:gap-x-8">
        {explanations.map((explanation) => (
          <li key={explanation.categoryKey}>
            <Eyebrow className="mb-1.5">{explanation.categoryLabel}リスク</Eyebrow>
            <ul className="space-y-1.5">
              {explanation.sources.map((source) => (
                <li key={source.sourceId} className="text-xs leading-relaxed text-ink-muted">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-navy hover:underline underline-offset-2"
                  >
                    {source.title}
                  </a>
                  <span className="text-ink-faint">({source.organization} · {source.effectiveDate})</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
