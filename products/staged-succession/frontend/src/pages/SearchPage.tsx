import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Company, Talent } from '../types';

const WORK_STYLE_LABEL: Record<Talent['workStyle'], string> = {
  remote: 'リモート',
  onsite: '現地',
  both: 'リモート/現地どちらも可',
};

interface CandidateEntry<T> {
  profile: T;
  connected: boolean;
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`font-jp shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        connected ? 'border-accent bg-surface-secondary text-accent-secondary' : 'border-border bg-surface text-muted-foreground'
      }`}
    >
      {connected ? 'つながり中' : '未接触'}
    </span>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="font-jp rounded-full border border-border bg-surface-secondary/60 px-2.5 py-1 text-[11px] text-accent-secondary">
      {children}
    </span>
  );
}

function TalentCard({ profile, connected }: CandidateEntry<Talent>) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mincho text-[16px] font-semibold text-foreground">{profile.name}</h3>
        <ConnectionBadge connected={connected} />
      </div>
      <p className="font-jp mt-1.5 text-[12px] text-muted-foreground">
        {profile.prefecture} / 週{profile.weeklyAvailableHours}時間 / {WORK_STYLE_LABEL[profile.workStyle]} / 承継関心度{' '}
        {profile.successionInterestLevel}/5
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.skills.map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
      </div>
      {profile.bio && <p className="font-jp mt-3 text-[13px] leading-relaxed text-foreground/80">{profile.bio}</p>}
    </div>
  );
}

function CompanyCard({ profile, connected }: CandidateEntry<Company>) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mincho text-[16px] font-semibold text-foreground">{profile.name}</h3>
        <ConnectionBadge connected={connected} />
      </div>
      <p className="font-jp mt-1.5 text-[12px] text-muted-foreground">
        {profile.industry} / {profile.prefecture}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.wantedPersonaTags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
      {profile.overview && <p className="font-jp mt-3 text-[13px] leading-relaxed text-foreground/80">{profile.overview}</p>}
    </div>
  );
}

export function SearchPage() {
  const { user, role } = useAuth();
  const [talents, setTalents] = useState<Talent[] | null>(null);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !role) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      role === 'company' ? api.listTalents() : api.listCompanies(),
      api.listMatchesForCaller(),
    ])
      .then(([list, { matches }]) => {
        if (cancelled) return;
        if (role === 'company') {
          setTalents((list as { talents: Talent[] }).talents);
        } else {
          setCompanies((list as { companies: Company[] }).companies);
        }
        const ids = new Set(
          matches
            .filter((m) => m.status === 'active')
            .map((m) => (role === 'company' ? m.talentId : m.companyId))
        );
        setConnectedIds(ids);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg space-y-5 px-5 py-7">
        <header className="animate-noren-rise">
          <h1 className="font-mincho text-[24px] font-semibold leading-tight text-foreground">さがす</h1>
          <p className="font-jp mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {role === 'company' ? '副業から関わってくれる人材を探せます。' : '副業から始められる企業を探せます。'}
          </p>
        </header>

        {loading ? (
          <p className="font-jp text-[13px] text-muted-foreground">読み込み中...</p>
        ) : error ? (
          <p className="font-jp rounded-2xl border border-border bg-surface p-3 text-[12px] text-danger shadow-card">{error}</p>
        ) : !role ? (
          <p className="font-jp rounded-2xl border border-border bg-surface p-4 text-[13px] text-muted-foreground shadow-card">
            ロールが設定されていないため、表示できる情報がありません。
          </p>
        ) : role === 'company' ? (
          talents && talents.length > 0 ? (
            <div className="space-y-3">
              {talents.map((t) => (
                <TalentCard key={t.id} profile={t} connected={connectedIds.has(t.id)} />
              ))}
            </div>
          ) : (
            <div className="noren-stripes rounded-2xl border border-dashed border-border px-5 py-8 text-center">
              <p className="font-jp text-[13px] text-muted-foreground">登録されている人材がまだいません。</p>
            </div>
          )
        ) : companies && companies.length > 0 ? (
          <div className="space-y-3">
            {companies.map((c) => (
              <CompanyCard key={c.id} profile={c} connected={connectedIds.has(c.id)} />
            ))}
          </div>
        ) : (
          <div className="noren-stripes rounded-2xl border border-dashed border-border px-5 py-8 text-center">
            <p className="font-jp text-[13px] text-muted-foreground">登録されている企業がまだいません。</p>
          </div>
        )}
      </div>
    </div>
  );
}
