import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';
import { Card, SectionHeader } from '../ui';

export function RiskMapPanel({ categories }: { categories: RiskCategoryResult[] }) {
  return (
    <Card as="section">
      <SectionHeader title="Risk Map" description="7つの領域ごとに、現在の備えに対する不足度を評価しています。" />

      <div className="space-y-4">
        {categories.map((c) => {
          const style = riskLevelStyle(c.level);
          return (
            <div key={c.key}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center justify-between sm:contents">
                  <span className="text-sm font-medium text-navy sm:w-16 sm:shrink-0">{c.label}</span>
                  <div className="flex items-center gap-2 sm:hidden">
                    <span className="text-sm font-semibold tabular-nums text-navy">{c.score}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
                  </div>
                </div>
                <div className="flex-1 h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${style.barClass}`}
                    style={{ width: `${Math.max(4, c.score)}%` }}
                  />
                </div>
                <span className="hidden sm:inline w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-navy">{c.score}</span>
                <span className={`hidden sm:inline shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
              </div>
              {c.reasons[0] && <p className="text-xs text-ink-muted mt-1 truncate sm:pl-20">{c.reasons[0]}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
