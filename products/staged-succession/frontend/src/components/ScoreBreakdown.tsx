import { ScoreBreakdown as ScoreBreakdownType } from '../types';

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="font-jp flex justify-between text-[11.5px] text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-surface-secondary">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Shows the score breakdown for whichever phase the match currently sits in, plus the overall total. */
export function ScoreBreakdown({ breakdown }: { breakdown: ScoreBreakdownType }) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-secondary p-4">
      <div className="flex items-center justify-between">
        <span className="font-jp text-[12.5px] font-semibold text-foreground">総合スコア</span>
        <span className="font-mincho text-[19px] font-bold text-gold">{Math.round(breakdown.currentTotal * 100)}%</span>
      </div>

      <div>
        <p className="font-jp mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          フェーズ1: 副業適合度
        </p>
        <div className="space-y-2">
          <Bar label="スキル適合" value={breakdown.phase1.skillFit} />
          <Bar label="稼働条件適合" value={breakdown.phase1.workloadFit} />
          <Bar label="業種興味度" value={breakdown.phase1.industryFit} />
          <Bar label="地域マッチ" value={breakdown.phase1.regionFit} />
        </div>
      </div>

      {breakdown.phase2to3 && (
        <div>
          <p className="font-jp mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            フェーズ2→3 昇格スコア
          </p>
          <div className="space-y-2">
            <Bar label="関与期間" value={breakdown.phase2to3.engagementDurationScore} />
            <Bar label="メッセージ量" value={breakdown.phase2to3.messageVolumeScore} />
            <Bar label="相互レビュー" value={breakdown.phase2to3.reviewScore} />
            <Bar label="フェーズ1引継ぎ" value={breakdown.phase2to3.phase1Carryover} />
          </div>
        </div>
      )}

      {breakdown.phase3 && (
        <div>
          <p className="font-jp mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            フェーズ3: 承継本気度
          </p>
          <div className="space-y-2">
            <Bar label="承継本気度" value={breakdown.phase3.successionSeriousness} />
            <Bar label="資金力適合" value={breakdown.phase3.fundingFit} />
            <Bar label="承継時期の近さ" value={breakdown.phase3.timingFit} />
            <Bar label="地域マッチ" value={breakdown.phase3.regionFit} />
          </div>
        </div>
      )}
    </div>
  );
}
