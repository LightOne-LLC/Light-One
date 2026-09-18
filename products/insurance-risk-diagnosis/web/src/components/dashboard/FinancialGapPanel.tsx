import type { RiskCategoryResult, RiskGap } from '../../types/diagnosis';
import { formatManYen, splitManYen } from '../../lib/riskLevelStyle';
import { Card, SectionHeader, Metric, Eyebrow } from '../ui';

const SEGMENTS = [
  { key: 'publicCoverage', label: '公的保障', bar: 'bg-risk-low', dot: 'bg-risk-low' },
  { key: 'ownAssets', label: '自己資産', bar: 'bg-navy-soft', dot: 'bg-navy-soft' },
  { key: 'existingInsurance', label: '既存の保険', bar: 'bg-platinum', dot: 'bg-platinum' },
] as const;

// 必要額を100%とした積み上げバー: 公的保障・自己資産・既存保険で埋まった分と、残る不足額を視覚化する。
function GapBar({ gap }: { gap: RiskGap }) {
  const { requiredAmount, publicCoverage, ownAssets, existingInsurance, shortfall } = gap;
  if (requiredAmount <= 0) return null;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / requiredAmount) * 100));

  let remaining = requiredAmount;
  const publicSeg = Math.min(publicCoverage, remaining);
  remaining -= publicSeg;
  const assetsSeg = Math.min(ownAssets, remaining);
  remaining -= assetsSeg;
  const existingSeg = Math.min(existingInsurance, remaining);
  remaining -= existingSeg;
  const shortfallSeg = Math.max(0, Math.min(shortfall, remaining));

  return (
    <div
      className="flex h-1.5 rounded-full overflow-hidden bg-surface-sunken"
      role="img"
      aria-label={`必要額${formatManYen(requiredAmount)}のうち不足額${formatManYen(shortfall)}`}
    >
      {publicSeg > 0 && <div className="bg-risk-low" style={{ width: `${pct(publicSeg)}%` }} />}
      {assetsSeg > 0 && <div className="bg-navy-soft" style={{ width: `${pct(assetsSeg)}%` }} />}
      {existingSeg > 0 && <div className="bg-platinum" style={{ width: `${pct(existingSeg)}%` }} />}
      {shortfallSeg > 0 && <div className="bg-risk-critical" style={{ width: `${pct(shortfallSeg)}%` }} />}
    </div>
  );
}

/*
  不足額の台帳。ドメインごとに「必要額 → 何で埋まっているか → 残り」を
  1行のレコードとして読ませる。カードをグリッドに並べると数値どうしの比較が
  できなくなるため、同じ左端に金額を揃えた行のリストにする。
*/
function GapRecord({ category }: { category: RiskCategoryResult }) {
  const gap = category.gap;
  if (!gap) return null;
  const covered = Math.max(0, gap.requiredAmount - gap.shortfall);
  const coveredPct = gap.requiredAmount > 0 ? Math.round((covered / gap.requiredAmount) * 100) : 100;

  return (
    <li className="py-6 first:pt-0 last:pb-0 border-b border-line-soft last:border-0">
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h3 className="text-[15px] font-semibold text-ink">{category.label}</h3>
        <p className="text-[11px] text-ink-faint tabular-nums">
          必要額 {formatManYen(gap.requiredAmount)}・充足 {coveredPct}%
        </p>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[11px] text-ink-faint">不足</span>
        <span className={`font-display-num text-2xl font-bold tabular-nums ${gap.shortfall > 0 ? 'text-risk-critical' : 'text-risk-low'}`}>
          {formatManYen(gap.shortfall)}
        </span>
      </div>

      <GapBar gap={gap} />

      <dl className="mt-3 grid grid-cols-3 gap-x-4">
        {SEGMENTS.map((s) => (
          <div key={s.key}>
            <dt className="flex items-center gap-1.5 text-[11px] text-ink-faint mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} aria-hidden="true" />
              {s.label}
            </dt>
            <dd className="text-[13px] font-medium tabular-nums text-ink-muted">{formatManYen(gap[s.key])}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

export function FinancialGapPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const withGap = categories.filter((c) => c.gap);
  if (withGap.length === 0) return null;

  // 領域ごとの不足額は性質が異なり単純合算できないため、合計ではなく
  // 「最も大きい不足額」を見出しの数値として提示する。
  const largest = withGap.slice().sort((a, b) => (b.gap!.shortfall) - (a.gap!.shortfall))[0];
  const headline = splitManYen(largest.gap!.shortfall);

  return (
    <Card as="section" variant="feature">
      <SectionHeader
        variant="editorial"
        eyebrow="Gap Analysis"
        title="Financial Gap"
        description="必要な資金に対して、公的保障・自己資産・既存の保険でどこまで備えられているかを示します。"
      />

      <div className="material-brushed border border-line-soft rounded-panel p-5 sm:p-6 mb-7">
        <Eyebrow className="mb-2">最も大きい不足額 — {largest.label}</Eyebrow>
        <Metric value={headline.value} unit={headline.unit} size="xl" tone={largest.gap!.shortfall > 0 ? 'danger' : 'default'} />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted max-w-lg">
          これは「今すぐこの金額の保険に入るべき」という意味ではなく、
          公的保障と自己資産を差し引いても残る差額の目安です。
        </p>
      </div>

      <ul>
        {withGap.map((c) => (
          <GapRecord key={c.key} category={c} />
        ))}
      </ul>
    </Card>
  );
}
