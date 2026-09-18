import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';

export function RiskMapPanel({ categories }: { categories: RiskCategoryResult[] }) {
  return (
    <section className="bg-surface rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">Risk Map</h2>
      <p className="text-sm text-slate-500 mb-6">7つの領域ごとに、現在の備えに対する不足度を評価しています。</p>

      <div className="space-y-5 sm:space-y-4">
        {categories.map((c) => {
          const style = riskLevelStyle(c.level);
          return (
            <div key={c.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center justify-between sm:contents">
                <span className="text-sm font-medium text-slate-700 sm:w-16 sm:shrink-0">{c.label}</span>
                <div className="flex items-center gap-2 sm:hidden">
                  <span className="text-sm font-semibold tabular-nums text-slate-800">{c.score}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
                </div>
              </div>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${style.barClass}`}
                  style={{ width: `${Math.max(4, c.score)}%` }}
                />
              </div>
              <span className="hidden sm:inline w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">{c.score}</span>
              <span className={`hidden sm:inline shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
