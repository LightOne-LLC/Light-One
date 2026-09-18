import { useState } from 'react';
import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle, formatManYen } from '../../lib/riskLevelStyle';
import { NEXT_STEPS } from '../../lib/nextSteps';
import { Card, SectionHeader } from '../ui';

function WhyItem({ category, defaultOpen }: { category: RiskCategoryResult; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const style = riskLevelStyle(category.level);

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-canvas transition-colors min-h-[44px]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
          <span className="text-sm font-semibold text-navy truncate">{category.label}リスク</span>
        </span>
        <span className="text-ink-muted text-xs shrink-0">{open ? '閉じる' : '詳細'}</span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 animate-fade-in">
          <p className="text-xs font-semibold text-ink-muted mb-2">この評価になった理由</p>
          <ul className="space-y-1.5 text-sm text-ink-muted mb-4">
            {category.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-line shrink-0">・</span>
                <span className="min-w-0 break-words">{r}</span>
              </li>
            ))}
          </ul>
          {category.gap && (
            <p className="text-sm text-navy mb-4">
              推定不足額の目安: <span className="font-semibold tabular-nums">{formatManYen(category.gap.shortfall)}</span>
            </p>
          )}
          <p className="text-xs font-semibold text-ink-muted mb-2">次に確認すること</p>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            {NEXT_STEPS[category.key].map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-gold shrink-0">→</span>
                <span className="min-w-0 break-words">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function WhyPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const sorted = categories.slice().sort((a, b) => b.score - a.score);
  return (
    <Card as="section">
      <SectionHeader title="Why?" description="各リスクについて、入力内容からどのように判定したか、次に何を確認すべきかを確認できます。" />
      <div className="space-y-3">
        {sorted.map((c, i) => (
          <WhyItem key={c.key} category={c} defaultOpen={i === 0} />
        ))}
      </div>
    </Card>
  );
}
