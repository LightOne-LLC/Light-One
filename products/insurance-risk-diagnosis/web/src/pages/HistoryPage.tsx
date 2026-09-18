import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HistoryItem } from '../types/diagnosis';
import { listDiagnosisHistory, deleteDiagnosisHistory } from '../lib/diagnosisStore';

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
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">診断履歴</h1>
        <Link to="/diagnosis" className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white">
          新しく診断する
        </Link>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!items && !error && <p className="text-slate-500 text-sm">読み込み中...</p>}
      {items && items.length === 0 && <p className="text-slate-500 text-sm">診断履歴はまだありません。</p>}

      <div className="space-y-2">
        {items?.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg border border-slate-200 p-4 hover:border-indigo-300 transition"
          >
            <Link to={`/result/${item.id}`} className="block">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">{new Date(item.createdAt).toLocaleString('ja-JP')}</span>
                <span className="text-sm font-medium text-indigo-700">
                  必要死亡保障額: {item.requiredDeathCoverage.toLocaleString('ja-JP')}万円
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.suggestedProductTypes.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">
                    {t}
                  </span>
                ))}
              </div>
            </Link>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
