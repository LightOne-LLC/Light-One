import { useState } from 'react';
import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle, formatManYen } from '../../lib/riskLevelStyle';
import { NEXT_STEPS } from '../../lib/nextSteps';
import { Card, SectionHeader, StatusChip, Eyebrow } from '../ui';

/*
  判定の根拠。各項目を枠線付きの箱にすると「7個のカード」に見えるため、
  罫線で区切られた一連の記事として組み、開いた項目だけが面を持つ。
*/
function WhyItem({ category, defaultOpen }: { category: RiskCategoryResult; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const style = riskLevelStyle(category.level);

  return (
    <div className="border-b border-line-soft last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-4 text-left min-h-[52px] group"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 min-w-0">
          <StatusChip label={style.label} className={`${style.badgeClass} shrink-0`} />
          <span className="text-[15px] font-medium text-ink truncate group-hover:text-navy transition-colors">{category.label}リスク</span>
        </span>
        <span className="flex items-center gap-2.5 shrink-0">
          <span className="font-display-num text-sm font-bold tabular-nums text-ink-faint">{category.score}</span>
          <span className={`text-ink-faint text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true">▼</span>
        </span>
      </button>

      {open && (
        <div className="pb-6 animate-fade-in sm:grid sm:grid-cols-2 sm:gap-8">
          <div className="mb-5 sm:mb-0">
            <Eyebrow className="mb-2.5">この評価になった理由</Eyebrow>
            <ul className="space-y-2">
              {category.reasons.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                  <span className="mt-[8px] w-2.5 h-px bg-line-strong shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{r}</span>
                </li>
              ))}
            </ul>
            {category.gap && (
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-xs text-ink-faint">推定不足額の目安</span>
                <span className="font-display-num text-lg font-bold tabular-nums text-ink">{formatManYen(category.gap.shortfall)}</span>
              </p>
            )}
          </div>

          <div className="material-brushed border border-line-soft rounded-panel p-4">
            <Eyebrow className="mb-2.5">次に確認すること</Eyebrow>
            <ul className="space-y-2">
              {NEXT_STEPS[category.key].map((s) => (
                <li key={s} className="flex gap-2.5 text-[13px] leading-relaxed text-ink">
                  <span className="text-platinum shrink-0" aria-hidden="true">→</span>
                  <span className="min-w-0 break-words">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function WhyPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const sorted = categories.slice().sort((a, b) => b.score - a.score);
  return (
    <Card as="section" variant="panel">
      <SectionHeader
        variant="editorial"
        eyebrow="Rationale"
        title="Why?"
        description="各リスクについて、入力内容からどのように判定したか、次に何を確認すべきかを確認できます。"
      />
      <div>
        {sorted.map((c, i) => (
          <WhyItem key={c.key} category={c} defaultOpen={i === 0} />
        ))}
      </div>
    </Card>
  );
}
