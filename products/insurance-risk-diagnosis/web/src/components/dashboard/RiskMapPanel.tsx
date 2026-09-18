import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';

export function RiskMapPanel({ categories }: { categories: RiskCategoryResult[] }) {
  return (
    <section className="bg-surface rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">Risk Map</h2>
      <p className="text-sm text-slate-500 mb-6">7つの領域ごとに、現在の備えに対する不足度を評価しています。</p>

      <div className="space-y-4">
        {categories.map((c) => {
          const style = riskLevelStyle(c.level);
          return (
            <div key={c.key} className="flex items-center gap-4">
              <span className="w-16 shrink-0 text-sm font-medium text-slate-700">{c.label}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${style.barClass}`}
                  style={{ width: `${Math.max(4, c.score)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">{c.score}</span>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
