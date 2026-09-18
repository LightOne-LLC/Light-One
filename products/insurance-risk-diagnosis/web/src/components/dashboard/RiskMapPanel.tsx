import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';
import { Card, SectionHeader, StatusChip } from '../ui';

/*
  7領域の一覧。ダッシュボードのバーの羅列ではなく、
  列見出しを持つ「計器の読み取り表」として組む。
  デスクトップでは列が揃うことで領域どうしを比較でき、
  モバイルでは比較の主役をスコアに絞って3行構成に組み替える。
*/
export function RiskMapPanel({ categories }: { categories: RiskCategoryResult[] }) {
  return (
    <Card as="section" variant="panel">
      <SectionHeader
        variant="editorial"
        eyebrow="Exposure"
        title="Risk Map"
        description="7つの領域ごとに、現在の備えに対する不足度を評価しています。数値が大きいほど確認の優先度が高くなります。"
      />

      <div className="hidden sm:grid grid-cols-[6.5rem_1fr_3rem_5.5rem] items-center gap-4 pb-2 border-b border-line">
        <span className="eyebrow text-ink-faint">Domain</span>
        <span className="eyebrow text-ink-faint">Exposure</span>
        <span className="eyebrow text-ink-faint text-right">Score</span>
        <span className="eyebrow text-ink-faint text-right">Level</span>
      </div>

      <ul>
        {categories.map((c) => {
          const style = riskLevelStyle(c.level);
          return (
            <li key={c.key} className="py-3.5 border-b border-line-soft last:border-0">
              <div className="sm:grid sm:grid-cols-[6.5rem_1fr_3rem_5.5rem] sm:items-center sm:gap-4">
                <div className="flex items-baseline justify-between gap-3 sm:block mb-2 sm:mb-0">
                  <span className="text-sm font-medium text-ink">{c.label}</span>
                  <span className="font-display-num text-lg font-bold tabular-nums text-ink sm:hidden">{c.score}</span>
                </div>

                <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${style.barClass}`}
                    style={{ width: `${Math.max(3, c.score)}%` }}
                  />
                </div>

                <span className="hidden sm:block font-display-num text-base font-bold tabular-nums text-ink text-right">{c.score}</span>
                <span className="hidden sm:flex justify-end">
                  <StatusChip label={style.label} className={style.badgeClass} />
                </span>
              </div>

              <div className="flex items-start gap-2.5 mt-2 sm:mt-1.5 sm:pl-[7.5rem]">
                <span className="sm:hidden shrink-0">
                  <StatusChip label={style.label} className={style.badgeClass} />
                </span>
                {c.reasons[0] && <p className="text-xs leading-relaxed text-ink-muted min-w-0">{c.reasons[0]}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
