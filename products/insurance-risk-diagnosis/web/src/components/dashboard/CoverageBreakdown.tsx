import type { DeathCoverageResult } from '../../types/diagnosis';
import { splitManYen } from '../../lib/riskLevelStyle';
import { findDirectSourcesForReason } from '../../rag';
import { Card, SectionHeader, Metric, Eyebrow } from '../ui';

function fmt(n: number) {
  return `${n.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}万円`;
}

/*
  計算根拠。加算項目と控除項目を同じ見た目で並べると読み解けないため、
  符号でグループを分け、控除側は罫線を弱めて「差し引かれている」ことを視覚化する。
*/
export function CoverageBreakdown({ deathCoverage }: { deathCoverage: DeathCoverageResult }) {
  const b = deathCoverage.breakdown;
  const required = splitManYen(deathCoverage.requiredAmount);

  const needs: { label: string; value: number }[] = [
    { label: '遺族生活費(末子独立まで)', value: b.phaseALivingCost },
    { label: '遺族生活費(末子独立後・配偶者)', value: b.phaseBLivingCost },
    { label: '教育費残り総額', value: b.educationTotal },
    { label: '葬儀費用等一時費用', value: b.funeralCost },
    ...(b.mortgageAddOn > 0 ? [{ label: '住宅ローン残高(団信未加入)', value: b.mortgageAddOn }] : []),
  ];

  const deductions: { label: string; value: number }[] = [
    { label: '遺族年金等 公的保障', value: b.survivorPensionTotal },
    { label: '貯蓄額', value: b.savings },
    { label: '保有資産', value: b.otherAssets },
    { label: '既存の死亡保険金', value: b.existingDeathCoverage },
  ];

  return (
    <Card variant="panel">
      <SectionHeader eyebrow="Calculation" title="死亡リスクの内訳詳細" />

      <div className="material-brushed border border-line-soft rounded-panel p-4 sm:p-5 mb-6">
        <Metric label="必要保障額" value={required.value} unit={required.unit} size="xl" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Eyebrow className="mb-3">必要となる金額</Eyebrow>
          <dl>
            {needs.map((row) => (
              <div key={row.label} className="flex justify-between gap-3 py-2 border-b border-line-soft last:border-0">
                <dt className="text-[13px] text-ink-muted min-w-0">{row.label}</dt>
                <dd className="text-[13px] font-medium tabular-nums text-ink shrink-0">{fmt(row.value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <Eyebrow className="mb-3">すでに備えられている金額</Eyebrow>
          <dl>
            {deductions.map((row) => (
              <div key={row.label} className="flex justify-between gap-3 py-2 border-b border-line-soft last:border-0">
                <dt className="text-[13px] text-ink-muted min-w-0">{row.label}</dt>
                <dd className="text-[13px] font-medium tabular-nums text-risk-low shrink-0">−{fmt(row.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <details className="mt-6 pt-4 border-t border-line">
        <summary className="text-[13px] text-navy cursor-pointer select-none">計算根拠の詳細を見る</summary>
        <ul className="mt-3 space-y-1.5">
          {deathCoverage.reasons.map((r, i) => {
            const sources = findDirectSourcesForReason(r, 'death');
            return (
              <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-ink-muted">
                <span className="mt-[7px] w-2 h-px bg-line-strong shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  {r}
                  {/*
                    ここではリンク付きの詳細は出さない。同じ出典はこの下のSourcesパネル
                    (EvidenceSourcesPanel)に集約して表示するため、行単位では
                    「どこが出典か」だけを示す小さなindicatorに留める。
                  */}
                  {sources.map((s) => (
                    <span key={s.sourceId} className="ml-2 text-[11px] text-ink-faint whitespace-nowrap">
                      出典: {s.organization}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </details>
    </Card>
  );
}
