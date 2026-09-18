import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HistoryItem } from '../types/diagnosis';
import { listDiagnosisHistory, deleteDiagnosisHistory } from '../lib/diagnosisStore';
import { riskLevelStyle, formatManYen } from '../lib/riskLevelStyle';

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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">診断履歴</h1>
        <Link to="/diagnosis" className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors">
          新しく診断する
        </Link>
      </div>

      {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}
      {!items && !error && <p className="text-slate-400 text-sm">読み込み中...</p>}
      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-400">診断履歴はまだありません。</p>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => {
          const topLevel = item.topRisks[0]?.level ?? 'low';
          const style = riskLevelStyle(topLevel);
          return (
            <div
              key={item.id}
              className="bg-surface rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-colors"
            >
              <Link to={`/result/${item.id}`} className="block">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('ja-JP')}</p>
                    <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
                      {item.overallScore}
                      <span className="text-sm font-medium text-slate-400"> / 100</span>
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">必要死亡保障額: {formatManYen(item.requiredDeathCoverage)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.topRisks.map((r) => (
                    <span key={r.label} className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 text-xs ring-1 ring-inset ring-slate-200">
                      {r.label}
                    </span>
                  ))}
                </div>
              </Link>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
