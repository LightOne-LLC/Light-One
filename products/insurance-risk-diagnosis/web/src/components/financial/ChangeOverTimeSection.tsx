import type { FinancialChange } from '../../financial';
import { Card, SectionHeader, Eyebrow } from '../ui';

/*
  Financial Snapshot同士の比較(compareSnapshots)を、Historyの「前回比」として表示する。
  診断結果(overallScore/category score)は既存DiagnosisResultをそのまま参照しているだけで、
  ここでは何も再計算していない。
*/

function formatChangeValue(value: number | string | null, unit?: string): string {
  if (value === null) return '未入力';
  if (typeof value === 'string') return value;
  return unit ? `${value.toLocaleString('ja-JP')}${unit}` : value.toLocaleString('ja-JP');
}

// カテゴリスコア等の「増減」を、既存のHistoryPage内ScoreDeltaと同じ視覚言語
// (▲=悪化・▼=改善・→=変化なし)で示す。スコアは「高いほどリスクが大きい」前提。
function ChangeDirection({ change }: { change: FinancialChange }) {
  if (change.direction === 'unchanged') {
    return <span className="text-[11px] text-ink-faint tabular-nums">→ 変化なし</span>;
  }
  if (change.direction === 'changed') {
    return (
      <span className="text-[11px] text-ink-muted tabular-nums">
        {formatChangeValue(change.previous, change.unit)} → {formatChangeValue(change.current, change.unit)}
      </span>
    );
  }
  const worse = change.direction === 'increased';
  return (
    <span className={`text-[11px] font-medium tabular-nums ${worse ? 'text-risk-critical' : 'text-risk-low'}`}>
      {worse ? '▲' : '▼'} {formatChangeValue(change.previous, change.unit)} → {formatChangeValue(change.current, change.unit)}
    </span>
  );
}

const CATEGORY_CHANGE_KEYS = ['death', 'medical', 'disability', 'retirement', 'care', 'asset', 'inheritance'].map((k) => `category:${k}`);
const PROFILE_CHANGE_KEYS = [
  'savings', 'investments', 'realEstateValue', 'mortgageBalance', 'otherLoanBalance',
  'annualIncome', 'spouseAnnualIncome', 'monthlyLivingExpense', 'existingDeathCoverage', 'monthlyPremiumTotal',
];

export function ChangeOverTimeSection({ changes }: { changes: FinancialChange[] }) {
  const overall = changes.find((c) => c.key === 'overallScore');
  const categoryChanges = CATEGORY_CHANGE_KEYS
    .map((key) => changes.find((c) => c.key === key))
    .filter((c): c is FinancialChange => c !== undefined);
  const profileChanges = PROFILE_CHANGE_KEYS
    .map((key) => changes.find((c) => c.key === key))
    .filter((c): c is FinancialChange => c !== undefined && c.direction !== 'unchanged');

  return (
    <Card as="section" variant="panel" className="mb-10 animate-rise">
      <SectionHeader
        variant="editorial"
        eyebrow="Change Over Time"
        title="前回からの変化"
        description="前回の診断からの、総合スコア・7領域のリスク・主な金融状態の変化です。"
      />

      {overall && (
        <div className="mb-6 flex items-baseline gap-3">
          <Eyebrow className="shrink-0">総合スコア</Eyebrow>
          <ChangeDirection change={overall} />
        </div>
      )}

      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 mb-6">
        {categoryChanges.map((change) => (
          <div key={change.key} className="flex items-center justify-between gap-3 py-1.5 border-b border-line-soft">
            <span className="text-[13px] text-ink">{change.label}</span>
            <ChangeDirection change={change} />
          </div>
        ))}
      </div>

      {profileChanges.length > 0 && (
        <div>
          <Eyebrow className="mb-2">主な変化</Eyebrow>
          <ul className="space-y-1.5">
            {profileChanges.map((change) => (
              <li key={change.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-ink-muted">{change.label}</span>
                <ChangeDirection change={change} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
