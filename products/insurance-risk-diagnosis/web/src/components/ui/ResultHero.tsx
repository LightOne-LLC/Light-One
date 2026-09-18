import type { RiskLevelLabel } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';
import { Metric } from './Metric';

// Result画面の最上部。「診断完了 → 総合的な状態 → 数値 → 短い説明 → 最重要リスク」の順で視線誘導する。
export function ResultHero({
  overallScore, topLevel, topLabel, topScore, message, date,
}: {
  overallScore: number;
  topLevel: RiskLevelLabel;
  topLabel?: string;
  topScore?: number;
  message: string;
  date: string;
}) {
  const style = riskLevelStyle(topLevel);
  return (
    <header className={`rounded-2xl border p-6 sm:p-10 ${style.badgeClass}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          診断完了
        </span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>

      <p className="text-xs font-semibold tracking-widest uppercase text-slate-500 mb-1">Your Financial Risk Profile</p>
      <Metric value={overallScore} unit="/ 100" size="lg" />
      <p className="mt-3 text-sm text-slate-600 max-w-md">{message}</p>

      {topLabel && (
        <div className="mt-5 pt-5 border-t border-white/40 flex items-center gap-3">
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${style.badgeClass} ring-1 ring-inset ring-white/50`}>{style.label}</span>
          <p className="text-sm text-slate-700">
            最も注意すべき領域: <span className="font-semibold">{topLabel}</span>
            {topScore !== undefined && <span className="text-slate-500">({topScore}点)</span>}
          </p>
        </div>
      )}
    </header>
  );
}
