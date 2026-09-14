import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Match, PhaseHistoryEntry } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { StarRating } from '../components/StarRating';

const PHASE_LABEL: Record<number | string, string> = {
  1: 'フェーズ1',
  2: 'フェーズ2',
  3: 'フェーズ3',
  declined: '解消',
  completed: '承継成立',
};

const PHASE_STEPS: { phase: 1 | 2 | 3; label: string }[] = [
  { phase: 1, label: '副業' },
  { phase: 2, label: '関係深化' },
  { phase: 3, label: '承継検討' },
];

function formatDate(ts: unknown): string {
  if (typeof ts === 'string') return new Date(ts).toLocaleString('ja-JP');
  return '-';
}

export function PhaseManagePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { role } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [history, setHistory] = useState<PhaseHistoryEntry[]>([]);
  const [evalResult, setEvalResult] = useState<{ eligible: boolean; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rating, setRating] = useState(5);

  const reload = useCallback(async () => {
    if (!matchId) return;
    const [matches1, matches2, matches3, h] = await Promise.all([
      api.listMatchesForCaller(1),
      api.listMatchesForCaller(2),
      api.listMatchesForCaller(3),
      api.listPhaseHistory(matchId),
    ]);
    const found = [...matches1.matches, ...matches2.matches, ...matches3.matches].find((m) => m.id === matchId) ?? null;
    setMatch(found);
    setHistory(h.history);
  }, [matchId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleEvaluate() {
    if (!matchId) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.evaluatePhaseUpgrade(matchId);
      setEvalResult(r);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: 'promote' | 'decline' | 'complete') {
    if (!matchId) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.changePhase(matchId, action);
      setMessage(action === 'promote' ? `フェーズ${r.phase}に昇格しました。` : `ステータスを更新しました: ${r.status}`);
      setEvalResult(null);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExpressIntent() {
    if (!matchId) return;
    setBusy(true);
    try {
      await api.expressContinuationIntent(matchId);
      setMessage('継続希望を表明しました。');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleReview() {
    if (!matchId) return;
    setBusy(true);
    try {
      await api.submitReview(matchId, rating);
      setMessage('レビューを送信しました。');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!match)
    return (
      <div className="min-h-screen bg-background">
        <p className="font-jp p-6 text-[13px] text-muted-foreground">マッチが見つかりません。</p>
      </div>
    );

  const myIntentGiven = role === 'talent' ? match.continuationIntent?.talent : match.continuationIntent?.company;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-5 px-5 py-7">
        <div className="animate-noren-rise flex items-center justify-between">
          <h1 className="font-mincho text-[22px] font-semibold leading-tight text-foreground">フェーズ管理</h1>
          <Link
            to={`/matches/${matchId}/chat`}
            className="font-jp text-[12px] text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            メッセージへ
          </Link>
        </div>

        {/* 現在地: どのフェーズにいるかを一目で分かるように */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center">
            {PHASE_STEPS.map((s, i) => (
              <div key={s.phase} className="flex flex-1 items-center">
                <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                      match.phase === s.phase
                        ? 'bg-gold text-accent-foreground'
                        : match.phase > s.phase
                          ? 'bg-accent text-accent-foreground'
                          : 'border border-border bg-surface-secondary text-muted-foreground'
                    }`}
                  >
                    {s.phase}
                  </div>
                  <span
                    className={`font-jp whitespace-nowrap text-[10.5px] ${
                      match.phase === s.phase ? 'font-semibold text-gold' : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < PHASE_STEPS.length - 1 && <div className="mb-5 h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
            <span className="font-jp truncate text-[11px] text-muted-foreground">
              {match.talentId} × {match.companyId}
            </span>
            <PhaseBadge phase={match.phase} status={match.status} />
          </div>
          <div className="mt-4">
            <ScoreBreakdown breakdown={match.scoreBreakdown} />
          </div>
        </div>

        {/* 現在の状態・必要なアクション */}
        {match.status === 'active' && match.phase === 1 && (
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="font-mincho text-[15px] font-semibold text-foreground">フェーズ2への昇格条件</h2>
            <p className="font-jp mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
              フェーズ1総合スコアが基準(60%)を超え、かつ双方が継続を希望すると昇格できます。
            </p>
            <div className="font-jp mt-3 flex gap-4 text-[12px] text-foreground/80">
              <span>人材の継続希望: {match.continuationIntent?.talent ? '✅' : '未表明'}</span>
              <span>企業の継続希望: {match.continuationIntent?.company ? '✅' : '未表明'}</span>
            </div>
            {!myIntentGiven && (
              <button
                onClick={handleExpressIntent}
                disabled={busy}
                className="font-jp mt-3 rounded-full border border-accent px-4 py-2 text-[12.5px] font-medium text-accent transition-colors hover:bg-surface-secondary disabled:opacity-50"
              >
                継続を希望する
              </button>
            )}
          </div>
        )}

        {match.status === 'active' && match.phase === 2 && (
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="font-mincho text-[15px] font-semibold text-foreground">相互レビュー（フェーズ3昇格スコアに反映）</h2>
            <div className="mt-3 flex items-center gap-3">
              <StarRating value={rating} onChange={setRating} />
              <button
                onClick={handleReview}
                disabled={busy}
                className="font-jp rounded-full border border-accent px-4 py-2 text-[12.5px] font-medium text-accent transition-colors hover:bg-surface-secondary disabled:opacity-50"
              >
                レビューを送信
              </button>
            </div>
          </div>
        )}

        {match.status === 'active' && (
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="font-mincho text-[15px] font-semibold text-foreground">操作</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {match.phase < 3 && (
                <button
                  onClick={handleEvaluate}
                  disabled={busy}
                  className="font-jp rounded-full border border-border px-3.5 py-2 text-[12.5px] font-medium text-foreground/80 transition-colors hover:bg-surface-secondary disabled:opacity-50"
                >
                  昇格判定を確認
                </button>
              )}
              {match.phase < 3 && (
                <button
                  onClick={() => handleAction('promote')}
                  disabled={busy}
                  className="font-jp rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground shadow-card transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  次のフェーズへ昇格
                </button>
              )}
              {match.phase === 3 && (
                <button
                  onClick={() => handleAction('complete')}
                  disabled={busy}
                  className="font-jp rounded-full bg-gold px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground shadow-card transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  承継成立にする
                </button>
              )}
              <button
                onClick={() => handleAction('decline')}
                disabled={busy}
                className="font-jp rounded-full border border-danger px-3.5 py-2 text-[12.5px] font-medium text-danger transition-colors hover:bg-surface-secondary disabled:opacity-50"
              >
                解消する
              </button>
            </div>
            {evalResult && (
              <p className={`font-jp mt-3 text-[12px] ${evalResult.eligible ? 'text-success' : 'text-muted-foreground'}`}>
                {evalResult.reason}
              </p>
            )}
            {message && <p className="font-jp mt-2 text-[12px] text-muted-foreground">{message}</p>}
          </div>
        )}

        {/* 履歴 */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="font-mincho text-[15px] font-semibold text-foreground">フェーズ変更履歴</h2>
          {history.length === 0 && <p className="font-jp mt-2 text-[12px] text-muted-foreground">履歴はまだありません。</p>}
          <ol className="mt-3 space-y-3">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-border pl-3.5 text-[12px] text-muted-foreground">
                <span className="font-jp font-medium text-foreground">
                  {h.fromPhase ? PHASE_LABEL[h.fromPhase] : '開始'} → {PHASE_LABEL[h.toPhase]}
                </span>
                <span className="font-jp ml-2 text-muted-foreground/70">{formatDate(h.createdAt)}</span>
                <p className="font-jp mt-0.5 text-foreground/70">{h.reason}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
