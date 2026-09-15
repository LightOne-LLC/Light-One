import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { AiCandidateScore, ScoreSource, scoreCandidates } from '../lib/matchScoring';
import { Company, Talent } from '../types';

const WORK_STYLE_LABEL: Record<Talent['workStyle'], string> = {
  remote: 'リモート',
  onsite: '現地',
  both: 'リモート/現地どちらも可',
};

type Candidate = Talent | Company;
type Decision = 'like' | 'skip';

interface DeckEntry {
  profile: Candidate;
  aiScore: AiCandidateScore;
}

function isTalent(c: Candidate): c is Talent {
  return 'skills' in c;
}

function Tag({ children }: { children: string }) {
  return (
    <span className="font-jp rounded-full border border-border bg-surface-secondary/60 px-2.5 py-1 text-[11px] text-accent-secondary">
      {children}
    </span>
  );
}

function CandidateMeta({ profile }: { profile: Candidate }) {
  if (isTalent(profile)) {
    return (
      <p className="font-jp mt-1.5 text-[12px] text-muted-foreground">
        {profile.prefecture} / 週{profile.weeklyAvailableHours}時間 / {WORK_STYLE_LABEL[profile.workStyle]} / 承継関心度{' '}
        {profile.successionInterestLevel}/5
      </p>
    );
  }
  return (
    <p className="font-jp mt-1.5 text-[12px] text-muted-foreground">
      {profile.industry} / {profile.prefecture}
    </p>
  );
}

function CandidateTags({ profile }: { profile: Candidate }) {
  const tags = isTalent(profile) ? profile.skills : profile.wantedPersonaTags;
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </div>
  );
}

function CandidateNote({ profile }: { profile: Candidate }) {
  const note = isTalent(profile) ? profile.bio : profile.overview;
  if (!note) return null;
  return <p className="font-jp mt-3 text-[13px] leading-relaxed text-foreground/80">{note}</p>;
}

const SWIPE_THRESHOLD = 96;
const FLY_DISTANCE = 640;
const SNAP_BACK_TRANSITION = 'transform 0.32s cubic-bezier(0.16,1,0.3,1)';
const FLY_TRANSITION = 'transform 0.32s cubic-bezier(0.16,1,0.3,1)';

function SwipeCard({
  entry,
  stackIndex,
  onDecision,
  busy,
}: {
  entry: DeckEntry;
  stackIndex: number;
  onDecision: (d: Decision) => void;
  busy: boolean;
}) {
  // Drag position lives entirely in refs + direct DOM writes, not React
  // state: updating React state on every pointermove forces a re-render per
  // pixel of finger movement, which isn't guaranteed to land in the same
  // frame as the browser's paint — that's what caused the "card lags a step
  // behind the finger" feel. Only *gesture end* (leaving) touches state,
  // since that happens once per swipe, not once per pixel.
  const [leaving, setLeaving] = useState<Decision | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const skipLabelRef = useRef<HTMLDivElement | null>(null);
  const likeLabelRef = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const pos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const isTop = stackIndex === 0;

  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  function paint() {
    rafId.current = null;
    const { x, y } = pos.current;
    if (cardRef.current) cardRef.current.style.transform = `translate(${x}px, ${y}px) rotate(${x / 22}deg)`;
    const strength = Math.min(Math.abs(x) / SWIPE_THRESHOLD, 1);
    if (skipLabelRef.current) skipLabelRef.current.style.opacity = x < -40 ? String(strength) : '0';
    if (likeLabelRef.current) likeLabelRef.current.style.opacity = x > 40 ? String(strength) : '0';
  }

  function schedulePaint() {
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(paint);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!isTop || leaving || busy) return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    if (cardRef.current) cardRef.current.style.transition = 'none';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || !start.current) return;
    pos.current = { x: e.clientX - start.current.x, y: (e.clientY - start.current.y) * 0.3 };
    schedulePaint();
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const { x } = pos.current;
    if (x > SWIPE_THRESHOLD) return fly('like');
    if (x < -SWIPE_THRESHOLD) return fly('skip');
    // snap back to center
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    pos.current = { x: 0, y: 0 };
    if (cardRef.current) {
      cardRef.current.style.transition = SNAP_BACK_TRANSITION;
      cardRef.current.style.transform = 'translate(0px, 0px) rotate(0deg)';
    }
    if (skipLabelRef.current) skipLabelRef.current.style.opacity = '0';
    if (likeLabelRef.current) likeLabelRef.current.style.opacity = '0';
  }

  function fly(decision: Decision) {
    if (busy) return;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    setLeaving(decision);
    if (cardRef.current) {
      cardRef.current.style.transition = FLY_TRANSITION;
      const x = decision === 'like' ? FLY_DISTANCE : -FLY_DISTANCE;
      cardRef.current.style.transform = `translate(${x}px, ${pos.current.y}px) rotate(${x / 22}deg)`;
    }
    // Decision + advancing to the next card is handled by the caller and is
    // intentionally decoupled from the api.likeOrSkip() network round trip
    // (see SearchPage.handleDecision) so the fly-away animation and the next
    // card's arrival aren't blocked waiting on Supabase.
    onDecision(decision);
  }

  const restingTransform = `translateY(${stackIndex * 10}px) scale(${1 - stackIndex * 0.04})`;
  const { profile, aiScore } = entry;

  return (
    <article
      ref={cardRef as React.RefObject<HTMLElement>}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute inset-0 flex touch-none select-none flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card ${
        isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
      }`}
      // transform/transition for the top card are managed imperatively above
      // (pointer handlers write directly to cardRef.current.style) so they're
      // deliberately left out of this object — including them here would
      // make React fight the imperative writes on every unrelated re-render.
      style={
        isTop
          ? { zIndex: 30 - stackIndex, opacity: 1 }
          : {
              transform: restingTransform,
              transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
              zIndex: 30 - stackIndex,
              opacity: stackIndex < 2 ? 1 : 0,
            }
      }
      aria-hidden={!isTop}
    >
      {isTop && (
        <>
          <div
            ref={skipLabelRef}
            className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border-2 border-danger px-3 py-1 font-mincho text-lg font-semibold text-danger"
            style={{ opacity: 0, transform: 'rotate(-8deg)' }}
          >
            Skip
          </div>
          <div
            ref={likeLabelRef}
            className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 border-accent px-3 py-1 font-mincho text-lg font-semibold text-accent"
            style={{ opacity: 0, transform: 'rotate(8deg)' }}
          >
            Like
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-mincho text-[19px] font-semibold leading-tight text-foreground">{profile.name}</h2>
          <span className="font-jp shrink-0 rounded-full border border-gold bg-surface-secondary px-2.5 py-1 text-[13px] font-semibold text-gold">
            {aiScore.score}
          </span>
        </div>
        <CandidateMeta profile={profile} />
        <CandidateTags profile={profile} />

        <p className="font-jp mt-3 text-[12px] leading-relaxed text-muted-foreground">{aiScore.reason}</p>

        {aiScore.strengths.length > 0 && (
          <ul className="mt-3 space-y-1">
            {aiScore.strengths.map((s) => (
              <li key={s} className="font-jp flex items-start gap-1.5 text-[12.5px] text-foreground/85">
                <span className="mt-0.5 text-success">＋</span>
                {s}
              </li>
            ))}
          </ul>
        )}
        {aiScore.concerns.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {aiScore.concerns.map((c) => (
              <li key={c} className="font-jp flex items-start gap-1.5 text-[12.5px] text-foreground/85">
                <span className="mt-0.5 text-danger">－</span>
                {c}
              </li>
            ))}
          </ul>
        )}

        <CandidateNote profile={profile} />
      </div>

      <div className="flex items-center justify-center gap-8 border-t border-border bg-surface px-5 py-4">
        <div className="flex flex-col items-center gap-1.5" data-no-drag>
          <button
            type="button"
            onClick={() => fly('skip')}
            disabled={busy || !isTop}
            aria-label="Skip"
            className="flex size-14 items-center justify-center rounded-full border-2 border-border text-muted-foreground transition-all duration-200 hover:border-danger hover:text-danger active:scale-90 disabled:opacity-50"
          >
            ✕
          </button>
          <span className="font-jp text-[11px] font-medium text-muted-foreground">見送る</span>
        </div>
        <div className="flex flex-col items-center gap-1.5" data-no-drag>
          <button
            type="button"
            onClick={() => fly('like')}
            disabled={busy || !isTop}
            aria-label="Like"
            className="flex size-14 items-center justify-center rounded-full border-2 border-transparent bg-accent text-accent-foreground shadow-card transition-all duration-200 hover:brightness-110 active:scale-90 disabled:opacity-50"
          >
            ♥
          </button>
          <span className="font-jp text-[11px] font-medium text-accent">興味あり</span>
        </div>
      </div>
    </article>
  );
}

export function SearchPage() {
  const { user, role } = useAuth();
  const [deck, setDeck] = useState<DeckEntry[] | null>(null);
  const [scoreSource, setScoreSource] = useState<ScoreSource | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matchedNotice, setMatchedNotice] = useState<{ name: string; matchId: string } | null>(null);

  useEffect(() => {
    if (!user || !role) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [myProfile, candidateList, decidedIds, { matches }] = await Promise.all([
          role === 'company' ? api.getCompany(user.id) : api.getTalent(user.id),
          role === 'company' ? api.listTalents() : api.listCompanies(),
          api.listDecidedTargetIds(),
          api.listMatchesForCaller(),
        ]);
        if (cancelled) return;

        const connectedIds = new Set(
          matches.filter((m) => m.status === 'active').map((m) => (role === 'company' ? m.talentId : m.companyId))
        );

        const rawCandidates: Candidate[] =
          role === 'company' ? (candidateList as { talents: Talent[] }).talents : (candidateList as { companies: Company[] }).companies;
        const candidates = rawCandidates.filter((c) => !decidedIds.has(c.id) && !connectedIds.has(c.id));

        const { scores, source } = await scoreCandidates(role, myProfile, candidates);
        if (cancelled) return;

        const entries: DeckEntry[] = candidates
          .map((profile) => ({ profile, aiScore: scores.get(profile.id) as AiCandidateScore }))
          .filter((e) => Boolean(e.aiScore))
          .sort((a, b) => b.aiScore.score - a.aiScore.score);

        setDeck(entries);
        setScoreSource(source);
        setIndex(0);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  function handleDecision(entry: DeckEntry, decision: Decision) {
    if (busy) return;
    setBusy(true);
    setError(null);

    // Advance to the next card as soon as the fly-away animation finishes —
    // deliberately not waiting on the Supabase round trip here, so a slow
    // network never stalls the swipe UI. api.likeOrSkip() still runs (and
    // `busy` still blocks a new swipe until it resolves), so double
    // Like/Skip is still prevented; it just no longer blocks *advancing*.
    setTimeout(() => setIndex((i) => i + 1), 260);

    api
      .likeOrSkip(entry.profile.id, decision)
      .then(({ match }) => {
        if (match) setMatchedNotice({ name: entry.profile.name, matchId: match.id });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const remaining = deck ? deck.slice(index) : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-lg flex-col px-5 py-7" style={{ minHeight: 'calc(100dvh - 3.5rem)' }}>
        <header className="animate-noren-rise">
          <h1 className="font-mincho text-[24px] font-semibold leading-tight text-foreground">さがす</h1>
          <p className="font-jp mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {role === 'company' ? '関心があれば右へ、見送るなら左へ。' : '副業から始められる企業を探せます。'}
          </p>
          {scoreSource === 'rule-based' && (
            <p className="font-jp mt-1 text-[10.5px] text-muted-foreground/70">現在ルールベースでスコアを算出しています。</p>
          )}
        </header>

        {matchedNotice && (
          <div className="font-jp mt-4 flex items-center justify-between gap-3 rounded-2xl border border-gold bg-surface-secondary px-4 py-3 text-[13px] shadow-card">
            <span className="text-foreground">
              🎉 <span className="font-semibold text-gold">{matchedNotice.name}</span>さんとマッチしました！
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Link to={`/matches/${matchedNotice.matchId}/chat`} className="text-accent underline-offset-4 hover:underline">
                メッセージを送る
              </Link>
              <button type="button" onClick={() => setMatchedNotice(null)} className="text-muted-foreground">
                閉じる
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="font-jp mt-4 rounded-2xl border border-border bg-surface p-3 text-[12px] text-danger shadow-card">{error}</p>
        )}

        <div className="relative mt-4 flex-1">
          {loading ? (
            <p className="font-jp text-[13px] text-muted-foreground">読み込み中...</p>
          ) : !role ? (
            <p className="font-jp rounded-2xl border border-border bg-surface p-4 text-[13px] text-muted-foreground shadow-card">
              ロールが設定されていないため、表示できる情報がありません。
            </p>
          ) : deck === null || deck.length === 0 ? (
            <div className="noren-stripes flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border px-8 text-center">
              <p className="font-jp text-[13px] text-muted-foreground">
                {role === 'company' ? '登録されている人材がまだいません。' : '登録されている企業がまだいません。'}
              </p>
            </div>
          ) : remaining.length === 0 ? (
            <div className="noren-stripes absolute inset-0 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border px-8 text-center">
              <h2 className="font-mincho text-[17px] font-semibold text-foreground">本日の候補は以上です</h2>
              <p className="font-jp mt-2 text-[13px] leading-relaxed text-muted-foreground">
                また後ほど新しい候補をご紹介します。
              </p>
              <button
                type="button"
                onClick={() => setIndex(0)}
                className="font-jp mt-5 rounded-full border border-border bg-surface px-5 py-2.5 text-[13px] font-medium text-accent transition-colors hover:bg-surface-secondary"
              >
                もう一度見る
              </button>
            </div>
          ) : (
            remaining
              .slice(0, 3)
              .map((entry, i) => (
                <SwipeCard
                  key={entry.profile.id}
                  entry={entry}
                  stackIndex={i}
                  busy={busy}
                  onDecision={(d) => handleDecision(entry, d)}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
}
