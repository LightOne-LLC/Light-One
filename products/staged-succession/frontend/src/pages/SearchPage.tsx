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
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        connected ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-600'
      }`}
    >
      {connected ? 'つながり中' : '未接触'}
    </span>
  );
}

function TalentCard({ profile, connected }: CandidateEntry<Talent>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{profile.name}</h3>
        <ConnectionBadge connected={connected} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {profile.prefecture} / 週{profile.weeklyAvailableHours}時間 / {WORK_STYLE_LABEL[profile.workStyle]} / 承継関心度{' '}
        {profile.successionInterestLevel}/5
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {profile.skills.map((s) => (
          <span key={s} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
            {s}
          </span>
        ))}
      </div>
      {profile.bio && <p className="mt-2 text-sm text-slate-600">{profile.bio}</p>}
    </div>
  );
}

function CompanyCard({ profile, connected }: CandidateEntry<Company>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{profile.name}</h3>
        <ConnectionBadge connected={connected} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {profile.industry} / {profile.prefecture}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {profile.wantedPersonaTags.map((t) => (
          <span key={t} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            {t}
          </span>
        ))}
      </div>
      {profile.overview && <p className="mt-2 text-sm text-slate-600">{profile.overview}</p>}
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
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <header>
        <h1 className="text-lg font-bold text-slate-900">さがす</h1>
        <p className="mt-1 text-sm text-slate-500">
          {role === 'company' ? '副業から関わってくれる人材を探せます。' : '副業から始められる企業を探せます。'}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>
      ) : !role ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
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
          <p className="text-sm text-slate-500">登録されている人材がまだいません。</p>
        )
      ) : companies && companies.length > 0 ? (
        <div className="space-y-3">
          {companies.map((c) => (
            <CompanyCard key={c.id} profile={c} connected={connectedIds.has(c.id)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">登録されている企業がまだいません。</p>
      )}
    </div>
  );
}
