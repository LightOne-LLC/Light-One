import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';
import { Card, SectionHeader } from '../ui';

export function TopRiskAreasPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const ranked = categories.slice().sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <Card as="section">
      <SectionHeader title="Top Risk Areas" description="現在の入力条件では、この順番で確認すると家計への影響が大きいと考えられます。" />
      <ol className="space-y-3">
        {ranked.map((c, i) => {
          const style = riskLevelStyle(c.level);
          return (
            <li key={c.key} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-semibold shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{c.label}リスク</p>
                <p className="text-xs text-slate-500 truncate">{c.reasons[0]}</p>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
