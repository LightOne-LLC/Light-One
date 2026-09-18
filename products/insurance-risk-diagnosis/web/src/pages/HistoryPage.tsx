import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HistoryItem } from '../types/diagnosis';
import { listDiagnosisHistory, deleteDiagnosisHistory } from '../lib/diagnosisStore';
import { riskLevelStyle, formatManYen } from '../lib/riskLevelStyle';
import { Card, Badge, Button, Metric, EmptyState, LoadingState } from '../components/ui';

export function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDiagnosisHistory()
      .then(setItems)
      .catch((e) => setError(e?.message ?? '履歴の取得に失敗しました。'));
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

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">診断履歴</h1>
        <Link to="/diagnosis">
          <Button variant="dark" size="sm">新しく診断する</Button>
        </Link>
      </div>

      {error && <p className="text-rose-600 text-sm mb-4" role="alert">{error}</p>}
      {!items && !error && <LoadingState message="履歴を読み込んでいます..." />}
      {items && items.length === 0 && (
        <EmptyState
          message="診断履歴はまだありません。"
          action={
            <Link to="/diagnosis">
              <Button variant="primary" size="sm">最初の診断を始める</Button>
            </Link>
          }
        />
      )}

      <div className="space-y-3">
        {items?.map((item) => {
          const topLevel = item.topRisks[0]?.level ?? 'low';
          const style = riskLevelStyle(topLevel);
          return (
            <Card key={item.id} className="hover:border-slate-300 transition-colors">
              <Link to={`/result/${item.id}`} className="block">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{new Date(item.createdAt).toLocaleString('ja-JP')}</p>
                    <Metric value={item.overallScore} unit="/ 100" size="md" />
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
                </div>
                {item.topRisks[0] && (
                  <p className="text-sm text-slate-700 mt-2">
                    最も注意すべき領域: <span className="font-medium">{item.topRisks[0].label}</span>
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">必要死亡保障額の目安: {formatManYen(item.requiredDeathCoverage)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.topRisks.map((r) => (
                    <Badge key={r.label}>{r.label}</Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs text-indigo-600 font-medium">結果を見る →</p>
              </Link>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-slate-400 hover:text-rose-600 transition-colors py-2 px-1 min-h-[36px]"
                >
                  削除
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
