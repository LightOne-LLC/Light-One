import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Match, MatchPhase } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';

const PHASE_STEPS: { phase: MatchPhase; label: string }[] = [
  { phase: 1, label: '副業' },
  { phase: 2, label: '関係深化' },
  { phase: 3, label: '承継検討' },
];

interface ConnectionCard {
  match: Match;
  counterpartName: string;
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 text-center shadow-card">
      <div className="font-mincho text-[26px] font-semibold leading-none tabular-nums text-accent">{value}</div>
      <div className="font-jp mt-1.5 text-[10.5px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

export function HomePage() {
  const { user, role } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [connections, setConnections] = useState<ConnectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !role) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (role === 'company' ? api.getCompany(user.id) : api.getTalent(user.id))
      .then((p) => {
        if (!cancelled) setDisplayName(p.name);
      })
      .catch(() => {
        /* プロフィール未登録: 固定文言のまま表示する */
      });

    api
      .listMatchesForCaller()
      .then(async ({ matches: all }) => {
        if (cancelled) return;
        setMatches(all);

        const top = all.filter((m) => m.status === 'active').slice(0, 5);
        const withNames = await Promise.all(
          top.map(async (m) => {
            try {
              const counterpartName =
                role === 'company' ? (await api.getTalent(m.talentId)).name : (await api.getCompany(m.companyId)).name;
              return { match: m, counterpartName };
            } catch {
              return { match: m, counterpartName: role === 'company' ? m.talentId : m.companyId };
            }
          })
        );
        if (!cancelled) setConnections(withNames);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  const activeMatches = matches.filter((m) => m.status === 'active');
  const todaysCandidates = activeMatches.filter((m) => m.phase === 1).length;
  const connectingCount = activeMatches.length;
  const totalMessages = activeMatches.reduce((sum, m) => sum + m.messageCount, 0);
  const phaseCounts = PHASE_STEPS.map((s) => ({ ...s, count: activeMatches.filter((m) => m.phase === s.phase).length }));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg space-y-7 px-5 py-7">
        <header className="animate-noren-rise">
          <p className="font-jp text-[13px] text-muted-foreground">おかえりなさい</p>
          {displayName && (
            <h1 className="font-mincho mt-0.5 text-[24px] font-semibold leading-tight text-foreground">
              {displayName}さん
            </h1>
          )}
          <p className="font-jp mt-2 text-[13px] leading-relaxed text-muted-foreground">
            今日のご縁の状況をお知らせします。
          </p>
        </header>

        {error && (
          <p className="font-jp rounded-2xl border border-border bg-surface p-3 text-[12px] text-danger shadow-card">
            {error}
          </p>
        )}

        {loading ? (
          <p className="font-jp text-[13px] text-muted-foreground">読み込み中...</p>
        ) : !role ? (
          <p className="font-jp rounded-2xl border border-border bg-surface p-4 text-[13px] text-muted-foreground shadow-card">
            ロールが設定されていないため、表示できる情報がありません。
          </p>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-3">
              <KpiTile label="本日の候補" value={todaysCandidates} />
              <KpiTile label="つながり中" value={connectingCount} />
              <KpiTile label="メッセージ数" value={totalMessages} />
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <h2 className="font-jp text-[13px] font-semibold text-foreground">ご縁の進捗</h2>
              <div className="mt-5 flex items-center">
                {phaseCounts.map((s, i) => (
                  <div key={s.phase} className="flex flex-1 items-center">
                    <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                          s.count > 0
                            ? 'bg-accent text-accent-foreground'
                            : 'border border-border bg-surface-secondary text-muted-foreground'
                        }`}
                      >
                        {s.count}
                      </div>
                      <span className="font-jp whitespace-nowrap text-[11px] text-muted-foreground">{s.label}</span>
                    </div>
                    {i < phaseCounts.length - 1 && <div className="mb-5 h-px flex-1 bg-border" />}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-mincho text-[17px] font-semibold text-foreground">つながり一覧</h2>
                <Link
                  to="/matches"
                  className="font-jp text-[12px] text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
                >
                  すべて見る
                </Link>
              </div>
              {connections.length === 0 ? (
                <div className="noren-stripes rounded-2xl border border-dashed border-border px-5 py-8 text-center">
                  <p className="font-jp text-[13px] text-muted-foreground">
                    進行中のつながりはまだありません。「マッチング」から候補を再計算してみましょう。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map(({ match, counterpartName }) => (
                    <div key={match.id} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mincho text-[15px] font-semibold text-foreground">{counterpartName}</span>
                        <PhaseBadge phase={match.phase} status={match.status} />
                      </div>
                      <p className="font-jp mt-1.5 text-[12px] text-muted-foreground">
                        メッセージ {match.messageCount}件 / マッチ度{' '}
                        <span className="font-semibold text-gold">{Math.round(match.scoreBreakdown.currentTotal * 100)}%</span>
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Link
                          to={`/matches/${match.id}/chat`}
                          className="font-jp flex-1 rounded-full border border-border px-3 py-1.5 text-center text-[12px] font-medium text-foreground/80 transition-colors hover:bg-surface-secondary"
                        >
                          メッセージ
                        </Link>
                        <Link
                          to={`/matches/${match.id}/phase`}
                          className="font-jp flex-1 rounded-full border border-border px-3 py-1.5 text-center text-[12px] font-medium text-foreground/80 transition-colors hover:bg-surface-secondary"
                        >
                          フェーズ管理
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
