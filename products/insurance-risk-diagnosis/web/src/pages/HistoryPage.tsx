import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HistoryItem } from '../types/diagnosis';
import { listDiagnosisHistory, listDiagnosisRecords, deleteDiagnosisHistory } from '../lib/diagnosisStore';
import { riskLevelStyle, formatManYen, splitManYen } from '../lib/riskLevelStyle';
import { buildFinancialSnapshot, compareSnapshots } from '../financial';
import type { FinancialChange } from '../financial';
import { ChangeOverTimeSection } from '../components/financial/ChangeOverTimeSection';
import { Card, Button, Metric, EmptyState, LoadingState, StatusChip, Eyebrow, SectionHeader } from '../components/ui';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

/*
  前回との差。スコアは「高いほどリスクが大きい」ため、
  上昇=注意、下降=改善として色と記号を割り当てる。
*/
function ScoreDelta({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) {
    return <span className="text-[11px] text-ink-faint">初回</span>;
  }
  const diff = current - previous;
  if (diff === 0) return <span className="text-[11px] text-ink-faint">±0</span>;
  const worse = diff > 0;
  return (
    <span className={`text-[11px] font-medium tabular-nums ${worse ? 'text-risk-critical' : 'text-risk-low'}`}>
      {worse ? '▲' : '▼'} {Math.abs(diff)}
    </span>
  );
}

export function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<FinancialChange[] | null>(null);

  useEffect(() => {
    listDiagnosisHistory()
      .then(setItems)
      .catch((e) => setError(e?.message ?? '履歴の取得に失敗しました。'));

    // Change Over Time は履歴が2件以上ある場合のみ意味を持つ、あくまで付加的な表示のため、
    // 取得に失敗しても(壊れた保存データ等)ページ全体のエラーにはしない。
    listDiagnosisRecords()
      .then((records) => {
        if (records.length < 2) return;
        const [current, previous] = records.map(buildFinancialSnapshot);
        setChanges(compareSnapshots(previous, current));
      })
      .catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('この診断履歴を削除しますか?')) return;
    try {
      await deleteDiagnosisHistory(id);
      setItems((prev) => prev?.filter((item) => item.id !== id) ?? null);
    } catch (e: any) {
      setError(e?.message ?? '削除に失敗しました。');
    }
  };

  const latest = items?.[0];
  const past = items?.slice(1) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-12">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-5 mb-8 border-b border-line">
        <div>
          <Eyebrow tone="accent" className="mb-2">Your Financial Journey</Eyebrow>
          <h1 className="text-[26px] sm:text-3xl font-bold tracking-[-0.02em] text-ink">診断ポートフォリオ</h1>
          {items && items.length > 0 && (
            <p className="mt-1.5 text-[13px] text-ink-muted tabular-nums">
              {items.length}件の記録 · 最新 {formatDate(items[0].createdAt)}
            </p>
          )}
        </div>
        <Link to="/diagnosis">
          <Button variant="primary" size="sm">新しく診断する</Button>
        </Link>
      </header>

      {error && <p className="text-risk-critical text-sm mb-4" role="alert">{error}</p>}
      {!items && !error && <LoadingState message="履歴を読み込んでいます..." />}
      {items && items.length === 0 && (
        <EmptyState
          eyebrow="No diagnosis yet"
          message="診断履歴はまだありません。最初の診断で、あなたのFinancial Profileを作成しましょう。"
          action={
            <Link to="/diagnosis">
              <Button variant="primary">最初の診断を始める</Button>
            </Link>
          }
        />
      )}

      {/* 最新の1件は結論として大きく扱い、過去分は比較できる台帳として畳む */}
      {latest && (
        <Card variant="feature" as="section" className="mb-10 animate-rise surface-sheen">
          <div className="grid gap-7 sm:gap-10 lg:grid-cols-[minmax(0,auto)_1fr] lg:items-start">
            <div className="lg:pr-6">
              <Metric label="Latest position" value={latest.overallScore} unit="/ 100" size="xl" />
              <div className="flex items-center gap-3 mt-4">
                <StatusChip
                  label={riskLevelStyle(latest.topRisks[0]?.level ?? 'low').label}
                  className={riskLevelStyle(latest.topRisks[0]?.level ?? 'low').badgeClass}
                />
                <span className="text-[11px] text-ink-faint tabular-nums">{formatDate(latest.createdAt)}</span>
              </div>
            </div>

            <div className="lg:border-l lg:border-line-soft lg:pl-10">
              {latest.topRisks[0] && (
                <div className="mb-5">
                  <Eyebrow className="mb-2">最も注意すべき領域</Eyebrow>
                  <p className="text-lg font-semibold tracking-[-0.01em] text-ink">{latest.topRisks[0].label}リスク</p>
                </div>
              )}

              <div className="mb-6">
                <Eyebrow className="mb-2">必要死亡保障額の目安</Eyebrow>
                <Metric
                  value={splitManYen(latest.requiredDeathCoverage).value}
                  unit={splitManYen(latest.requiredDeathCoverage).unit}
                  size="md"
                />
              </div>

              {latest.topRisks.length > 0 && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 mb-7">
                  {latest.topRisks.map((r, i) => (
                    <span key={r.label} className="flex items-baseline gap-2">
                      <span className="font-display-num text-[11px] font-bold tabular-nums text-platinum">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[13px] text-ink-muted">{r.label}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4">
                <Link to={`/result/${latest.id}`}>
                  <Button variant="primary" size="sm">このレポートを開く</Button>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(latest.id)}
                  className="text-xs text-ink-faint hover:text-risk-critical transition-colors min-h-[38px] px-1"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {changes && <ChangeOverTimeSection changes={changes} />}

      {past.length > 0 && (
        <section>
          <SectionHeader variant="compact" title="これまでの記録" aside={<span className="text-[11px] text-ink-faint tabular-nums">{past.length}件</span>} />
          <ul className="border-t border-line">
            {past.map((item, i) => {
              const style = riskLevelStyle(item.topRisks[0]?.level ?? 'low');
              const older = past[i + 1] ?? undefined;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 border-b border-line-soft hover:bg-surface/70 transition-colors animate-rise"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <Link
                    to={`/result/${item.id}`}
                    className="flex-1 min-w-0 grid grid-cols-[1fr_auto] sm:grid-cols-[9.5rem_5.5rem_1fr_auto] items-center gap-x-4 gap-y-1 py-4"
                  >
                    <span className="text-[13px] text-ink-muted tabular-nums order-1">{formatDate(item.createdAt)}</span>

                    <span className="flex items-baseline gap-2 order-3 sm:order-2">
                      <span className="font-display-num text-lg font-bold tabular-nums text-ink">{item.overallScore}</span>
                      <ScoreDelta current={item.overallScore} previous={older?.overallScore} />
                    </span>

                    <span className="text-[13px] text-ink-muted truncate order-4 sm:order-3">
                      {item.topRisks[0] ? `${item.topRisks[0].label}リスク` : '—'}
                      <span className="text-ink-faint"> · {formatManYen(item.requiredDeathCoverage)}</span>
                    </span>

                    <span className="order-2 sm:order-4 justify-self-end">
                      <StatusChip label={style.label} className={style.badgeClass} />
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 text-xs text-ink-faint hover:text-risk-critical transition-colors min-h-[44px] px-2"
                    aria-label={`${formatDate(item.createdAt)}の診断履歴を削除`}
                  >
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
