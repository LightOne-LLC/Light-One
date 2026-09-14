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
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
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
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <header>
        <h1 className="text-lg font-bold text-slate-900">おかえりなさい{displayName ? `、${displayName}さん` : ''}</h1>
        <p className="mt-1 text-sm text-slate-500">今日のご縁の状況をお知らせします。</p>
      </header>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : !role ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          ロールが設定されていないため、表示できる情報がありません。
        </p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3">
            <KpiTile label="本日の候補" value={todaysCandidates} />
            <KpiTile label="つながり中" value={connectingCount} />
            <KpiTile label="メッセージ数" value={totalMessages} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">ご縁の進捗</h2>
            <div className="flex items-center">
              {phaseCounts.map((s, i) => (
                <div key={s.phase} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                        s.count > 0 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {s.count}
                    </div>
                    <span className="mt-1 text-[11px] text-slate-600">{s.label}</span>
                  </div>
                  {i < phaseCounts.length - 1 && <div className="mb-4 h-px flex-1 bg-slate-300" />}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">つながり一覧</h2>
              <Link to="/matches" className="text-xs text-slate-500 underline">
                すべて見る
              </Link>
            </div>
            {connections.length === 0 ? (
              <p className="text-sm text-slate-500">
                進行中のつながりはまだありません。「マッチング」から候補を再計算してみましょう。
              </p>
            ) : (
              <div className="space-y-3">
                {connections.map(({ match, counterpartName }) => (
                  <div key={match.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">{counterpartName}</span>
                      <PhaseBadge phase={match.phase} status={match.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      メッセージ {match.messageCount}件 / マッチ度 {Math.round(match.scoreBreakdown.currentTotal * 100)}%
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Link
                        to={`/matches/${match.id}/chat`}
                        className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-center text-xs font-medium hover:bg-slate-100"
                      >
                        メッセージ
                      </Link>
                      <Link
                        to={`/matches/${match.id}/phase`}
                        className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-center text-xs font-medium hover:bg-slate-100"
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
  );
}
