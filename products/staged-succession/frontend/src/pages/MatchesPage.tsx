import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Match, MatchPhase } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';

const TABS: { phase: MatchPhase; label: string }[] = [
  { phase: 1, label: 'フェーズ1: 副業お試し' },
  { phase: 2, label: 'フェーズ2: 関係深化' },
  { phase: 3, label: 'フェーズ3: 承継検討' },
];

export function MatchesPage() {
  const [phase, setPhase] = useState<MatchPhase>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(p: MatchPhase) {
    setLoading(true);
    try {
      const r = await api.listMatchesForCaller(p);
      setMatches(r.matches);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(phase);
  }, [phase]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const r = await api.refreshMatchesForCaller();
      setMessage(`${r.matched}件の候補を再計算しました。`);
      await load(phase);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-7">
        <div className="animate-noren-rise mb-5 flex items-center justify-between gap-3">
          <h1 className="font-mincho text-[22px] font-semibold leading-tight text-foreground">マッチング候補</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="font-jp shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-foreground shadow-card transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '計算中...' : '候補を再計算'}
          </button>
        </div>
        {message && <p className="font-jp mb-4 text-[12.5px] text-muted-foreground">{message}</p>}

        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.phase}
              onClick={() => setPhase(t.phase)}
              className={`font-jp rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                phase === t.phase
                  ? 'border-transparent bg-accent text-accent-foreground shadow-card'
                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="font-jp text-[13px] text-muted-foreground">読み込み中...</p>
        ) : matches.length === 0 ? (
          <div className="noren-stripes rounded-2xl border border-dashed border-border px-5 py-8 text-center">
            <p className="font-jp text-[13px] text-muted-foreground">
              このフェーズの候補はまだありません。「候補を再計算」を押してください。
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {matches.map((m) => (
              <div key={m.id} className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-jp truncate text-[11px] text-muted-foreground">
                    {m.talentId} × {m.companyId}
                  </span>
                  <PhaseBadge phase={m.phase} status={m.status} />
                </div>
                <ScoreBreakdown breakdown={m.scoreBreakdown} />
                <div className="flex gap-2">
                  <Link
                    to={`/matches/${m.id}/chat`}
                    className="font-jp flex-1 rounded-full border border-border px-3 py-1.5 text-center text-[12px] font-medium text-foreground/80 transition-colors hover:bg-surface-secondary"
                  >
                    メッセージ
                  </Link>
                  <Link
                    to={`/matches/${m.id}/phase`}
                    className="font-jp flex-1 rounded-full border border-border px-3 py-1.5 text-center text-[12px] font-medium text-foreground/80 transition-colors hover:bg-surface-secondary"
                  >
                    フェーズ管理
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
