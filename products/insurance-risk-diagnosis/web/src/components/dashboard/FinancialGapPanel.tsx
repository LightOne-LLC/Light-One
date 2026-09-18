import type { RiskCategoryResult } from '../../types/diagnosis';
import { formatManYen } from '../../lib/riskLevelStyle';
import { Card, SectionHeader } from '../ui';

function GapRow({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-slate-100 last:border-0">
      <span className={emphasis ? 'text-sm font-semibold text-slate-900' : 'text-sm text-slate-500'}>{label}</span>
      <span className={`tabular-nums ${emphasis ? 'text-base font-bold text-rose-600' : 'text-sm font-medium text-slate-700'}`}>
        {formatManYen(value)}
      </span>
    </div>
  );
}

function GapCard({ category }: { category: RiskCategoryResult }) {
  const gap = category.gap;
  if (!gap) return null;
  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">{category.label}</h3>
      <GapRow label="必要額" value={gap.requiredAmount} />
      <GapRow label="公的保障" value={-gap.publicCoverage} />
      <GapRow label="自己資産" value={-gap.ownAssets} />
      <GapRow label="既存の保険" value={-gap.existingInsurance} />
      <GapRow label="推定不足額" value={gap.shortfall} emphasis />
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
        description="必要な資金から、公的保障・自己資産・既存の保険を差し引いた、いま確認しておきたい不足額です。"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {withGap.map((c) => (
          <GapCard key={c.key} category={c} />
        ))}
      </div>
    </Card>
  );
}
