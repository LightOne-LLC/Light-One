import { MatchPhase, MatchStatus } from '../types';

const PHASE_LABEL: Record<MatchPhase, string> = {
  1: 'フェーズ1: 副業お試し',
  2: 'フェーズ2: 関係深化',
  3: 'フェーズ3: 承継検討',
};

// Phase depth is expressed as a quiet gradation (muted -> accent -> gold)
// rather than unrelated hues, to match the NOREN "deepening relationship"
// visual language instead of a SaaS-style rainbow status color scheme.
const PHASE_COLOR: Record<MatchPhase, string> = {
  1: 'border-border bg-surface-secondary text-muted-foreground',
  2: 'border-accent bg-surface-secondary text-accent-secondary',
  3: 'border-gold bg-surface-secondary text-gold',
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  active: '進行中',
  declined: '解消',
  completed: '承継成立',
};

const STATUS_COLOR: Record<MatchStatus, string> = {
  active: 'border-border bg-surface text-muted-foreground',
  declined: 'border-border bg-surface text-danger',
  completed: 'border-border bg-surface text-success',
};

export function PhaseBadge({ phase, status }: { phase: MatchPhase; status?: MatchStatus }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-jp rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${PHASE_COLOR[phase]}`}>
        {PHASE_LABEL[phase]}
      </span>
      {status && status !== 'active' && (
        <span className={`font-jp rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      )}
    </div>
  );
}
