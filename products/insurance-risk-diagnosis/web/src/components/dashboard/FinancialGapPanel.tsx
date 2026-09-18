import type { RiskCategoryResult } from '../../types/diagnosis';
import { formatManYen } from '../../lib/riskLevelStyle';
import { Card, SectionHeader } from '../ui';

function GapRow({ label, value, swatchClass }: { label: string; value: number; swatchClass: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-line last:border-0">
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        <span className={`w-2 h-2 rounded-full shrink-0 ${swatchClass}`} aria-hidden="true" />
        {label}
      </span>
      <span className="tabular-nums text-sm font-medium text-navy">{formatManYen(value)}</span>
    </div>
  );
}

// 必要額を100%とした積み上げバー: 公的保障・自己資産・既存保険で埋まった分と、残る不足額を視覚化する。
function GapBar({ requiredAmount, publicCoverage, ownAssets, existingInsurance, shortfall }: {
  requiredAmount: number; publicCoverage: number; ownAssets: number; existingInsurance: number; shortfall: number;
}) {
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
    <div className="flex h-2 rounded-full overflow-hidden bg-line mb-4" role="img" aria-label={`必要額${formatManYen(requiredAmount)}のうち不足額${formatManYen(shortfall)}`}>
      {publicSeg > 0 && <div className="bg-emerald-400/80" style={{ width: `${pct(publicSeg)}%` }} />}
      {assetsSeg > 0 && <div className="bg-sky-400/80" style={{ width: `${pct(assetsSeg)}%` }} />}
      {existingSeg > 0 && <div className="bg-gold" style={{ width: `${pct(existingSeg)}%` }} />}
      {shortfallSeg > 0 && <div className="bg-rose-400/90" style={{ width: `${pct(shortfallSeg)}%` }} />}
    </div>
  );
}

function GapCard({ category }: { category: RiskCategoryResult }) {
  const gap = category.gap;
  if (!gap) return null;
  return (
    <div className="rounded-xl border border-line p-5">
      <h3 className="text-xs font-medium tracking-wide text-ink-muted mb-2">{category.label}・推定不足額</h3>
      <p className="font-display-num text-3xl font-bold text-navy mb-1">{formatManYen(gap.shortfall)}</p>
      <p className="text-xs text-ink-muted mb-4">必要額 {formatManYen(gap.requiredAmount)} のうち</p>
      <GapBar {...gap} />
      <GapRow label="公的保障" value={gap.publicCoverage} swatchClass="bg-emerald-400/80" />
      <GapRow label="自己資産" value={gap.ownAssets} swatchClass="bg-sky-400/80" />
      <GapRow label="既存の保険" value={gap.existingInsurance} swatchClass="bg-gold" />
    </div>
  );
}

export function FinancialGapPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const withGap = categories.filter((c) => c.gap);
  if (withGap.length === 0) return null;
  return (
    <Card as="section">
      <SectionHeader
        title="Financial Gap"
        description="必要な資金に対して、公的保障・自己資産・既存の保険でどこまで備えられているかを示します。"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {withGap.map((c) => (
          <GapCard key={c.key} category={c} />
        ))}
      </div>
    </Card>
  );
}
