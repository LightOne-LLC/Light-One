import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { FinancialIntelligence } from '../../financial';
import { formatManYen } from '../../lib/riskLevelStyle';
import { Card, SectionHeader, Eyebrow, Metric } from '../ui';

/*
  Personal Financial Intelligence(Phase 4)の表示本体。
  データ取得(FinancialProfilePage)から分離した純粋なpresentational component。
  既存のdashboard panel群と同じく、渡されたintelligenceをそのまま表示するだけで
  新しい計算・判断は行わない。
*/

function fmt(n: number): string {
  return formatManYen(n);
}

function fmtUnknown(v: number | 'unknown'): string {
  return v === 'unknown' ? '不明(未入力)' : fmt(v);
}

function ReportSection({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-4 mb-4 sm:mb-5">
        <span className="font-display-num text-xs font-bold tabular-nums text-platinum shrink-0">{index}</span>
        <h2 className="text-[13px] sm:text-sm font-semibold tracking-[0.04em] text-ink shrink-0">{title}</h2>
        <hr className="rule-fade flex-1 min-w-0" />
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, emphasis, compact }: { label: string; value: string; emphasis?: boolean; compact?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${compact ? 'py-1' : 'py-2'} ${!compact ? 'border-b border-line-soft last:border-0' : ''}`}>
      <dt className={compact ? 'text-[11px] text-ink-faint' : 'text-[13px] text-ink-muted'}>{label}</dt>
      <dd className={`tabular-nums ${emphasis ? 'font-semibold text-ink' : compact ? 'text-[11px] font-medium text-ink-muted' : 'text-[13px] font-medium text-ink'}`}>
        {value}
      </dd>
    </div>
  );
}

function occupationLabel(t: FinancialIntelligence['currentState']['household']['occupationType']): string {
  if (t === 'self_employed') return '自営業';
  if (t === 'public_servant') return '公務員';
  return '会社員';
}

export function FinancialProfileReport({ intelligence, resultId }: { intelligence: FinancialIntelligence; resultId: string }) {
  const { currentState, keyChanges, riskAreas, missingInformation } = intelligence;
  const changesSectionIndex = keyChanges.length > 0 ? '05' : null;
  const missingSectionIndex = keyChanges.length > 0 ? '06' : '05';

  return (
    <article className="space-y-10 sm:space-y-14">
      <header className="animate-rise">
        <Eyebrow tone="accent" className="mb-2">Personal Financial Intelligence</Eyebrow>
        <h2 className="text-[26px] sm:text-3xl font-bold tracking-[-0.02em] text-ink">Financial Profile</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted max-w-xl">
          診断結果と入力内容から、資産・負債・保障ギャップを整理したものです。新しい採点や判断は行わず、既存の事実を並べています。
        </p>
      </header>

      <ReportSection index="01" title="家計の概要">
        <Card variant="panel">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-4">
            <div>
              <dt className="eyebrow text-ink-faint mb-1">年齢</dt>
              <dd className="font-display-num text-lg font-bold text-ink">{currentState.household.age}歳</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink-faint mb-1">配偶者</dt>
              <dd className="text-sm font-medium text-ink">{currentState.household.hasSpouse ? 'あり' : 'なし'}</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink-faint mb-1">子供</dt>
              <dd className="text-sm font-medium text-ink">{currentState.household.childrenCount}人</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink-faint mb-1">雇用形態</dt>
              <dd className="text-sm font-medium text-ink">{occupationLabel(currentState.household.occupationType)}</dd>
            </div>
          </dl>
        </Card>
      </ReportSection>

      <ReportSection index="02" title="Balance Sheet(資産・負債)">
        <Card variant="panel">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Eyebrow className="mb-3">Assets</Eyebrow>
              <dl>
                <Row label="現預金" value={fmt(currentState.balanceSheet.assets.cash)} />
                <Row label="投資性資産" value={fmt(currentState.balanceSheet.assets.investments)} />
                <Row label="不動産評価額" value={fmt(currentState.balanceSheet.assets.realEstate)} />
                <Row label="資産合計" value={fmt(currentState.balanceSheet.assets.total)} emphasis />
              </dl>
            </div>
            <div>
              <Eyebrow className="mb-3">Liabilities</Eyebrow>
              <dl>
                <Row label="住宅ローン残高" value={fmt(currentState.balanceSheet.liabilities.mortgage)} />
                <Row label="その他借入残高" value={fmt(currentState.balanceSheet.liabilities.otherDebt)} />
                <Row label="負債合計" value={fmt(currentState.balanceSheet.liabilities.total)} emphasis />
              </dl>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-line-soft">
            <Metric label="純資産(資産−負債)" value={currentState.balanceSheet.netPosition.toLocaleString('ja-JP')} unit="万円" size="lg" />
          </div>
        </Card>
      </ReportSection>

      <ReportSection index="03" title="Cash Flow(月次収支)">
        <Card variant="panel">
          <dl>
            <Row label="本人の月収" value={`${currentState.cashFlow.selfMonthlyIncome.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`} />
            <Row label="配偶者の月収" value={fmtUnknown(currentState.cashFlow.spouseMonthlyIncome)} />
            <Row label="月間生活費" value={fmtUnknown(currentState.cashFlow.monthlyLivingCost)} />
            <Row label="月間収支(概算)" value={fmtUnknown(currentState.cashFlow.monthlySurplus)} emphasis />
          </dl>
        </Card>
      </ReportSection>

      <ReportSection index="04" title="Protection Gap(保障ギャップ)">
        <Card variant="panel">
          {currentState.protection.byCategory.length === 0 ? (
            <p className="text-[13px] text-ink-muted">保障ギャップを算出できる領域がありません。</p>
          ) : (
            <ul>
              {currentState.protection.byCategory.map((entry) => (
                <li key={entry.key} className="py-4 border-b border-line-soft last:border-0">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h3 className="text-[15px] font-semibold text-ink">{entry.label}</h3>
                    <span className={`font-display-num text-lg font-bold tabular-nums ${entry.gap.shortfall > 0 ? 'text-risk-critical' : 'text-risk-low'}`}>
                      {fmt(entry.gap.shortfall)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                    <Row label="必要額" value={fmt(entry.gap.requiredAmount)} compact />
                    <Row label="公的保障" value={fmt(entry.gap.publicCoverage)} compact />
                    <Row label="自己資産" value={fmt(entry.gap.ownAssets)} compact />
                    <Row label="既存の保険" value={fmt(entry.gap.existingInsurance)} compact />
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </ReportSection>

      {changesSectionIndex && (
        <ReportSection index={changesSectionIndex} title="前回からの変化">
          <Card variant="quiet">
            <p className="text-[13px] text-ink-muted">
              詳しい変化は<Link to="/history" className="text-navy hover:underline underline-offset-2">履歴ページ</Link>で確認できます。
            </p>
          </Card>
        </ReportSection>
      )}

      <ReportSection index={missingSectionIndex} title="今後の診断精度を上げるために">
        {missingInformation.length === 0 ? (
          <Card variant="quiet">
            <p className="text-[13px] text-ink-muted">現在、未入力の項目はありません。</p>
          </Card>
        ) : (
          <Card variant="quiet">
            <SectionHeader variant="compact" title="現時点で未入力の情報" />
            <ul className="space-y-1.5">
              {missingInformation.map((item) => (
                <li key={item.key} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                  <span className="mt-[7px] w-2 h-px bg-line-strong shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </ReportSection>

      {riskAreas.length > 0 && (
        <footer className="pt-2 border-t border-line">
          <Eyebrow className="mb-3">優先して確認すべき領域</Eyebrow>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {riskAreas.map((area, i) => (
              <span key={area.key} className="flex items-baseline gap-2">
                <span className="font-display-num text-[11px] font-bold tabular-nums text-platinum">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[13px] text-ink-muted">{area.label}リスク</span>
              </span>
            ))}
          </div>
          <Link
            to={`/result/${resultId}`}
            className="inline-block mt-4 text-[13px] text-navy hover:underline underline-offset-2"
          >
            診断結果に戻る →
          </Link>
        </footer>
      )}
    </article>
  );
}
