import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';
import { Card, SectionHeader, StatusChip } from '../ui';

/*
  優先順位を示す面。カードを並べるのではなく、順位そのものを紙面の骨格にする。
  大きな連番 → 領域名 → 判定 → 理由、という一方向の読み順を作り、
  行の間は罫線のみで区切る(箱の中に箱を作らない)。
*/
export function TopRiskAreasPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const ranked = categories.slice().sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <Card as="section" variant="feature">
      <SectionHeader
        variant="editorial"
        eyebrow="Priority"
        title="Top Risk Areas"
        description="現在の入力条件では、この順番で確認すると家計への影響が大きいと考えられます。"
      />
      <ol>
        {ranked.map((c, i) => {
          const style = riskLevelStyle(c.level);
          return (
            <li
              key={c.key}
              className="grid grid-cols-[auto_1fr] gap-x-4 sm:gap-x-6 py-5 first:pt-0 last:pb-0 border-b border-line-soft last:border-0"
            >
              <span className="font-display-num text-3xl sm:text-4xl font-bold leading-none text-line-strong tabular-nums pt-0.5" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="text-[17px] sm:text-lg font-semibold tracking-[-0.01em] text-ink">{c.label}リスク</h3>
                  <div className="flex items-baseline gap-3 shrink-0">
                    <span className="font-display-num text-xl font-bold tabular-nums text-ink">{c.score}</span>
                    <StatusChip label={style.label} className={style.badgeClass} />
                  </div>
                </div>
                {c.reasons[0] && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{c.reasons[0]}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
