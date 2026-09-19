import { Card } from './Card';
import { Eyebrow } from './SectionHeader';
import { Metric } from './Metric';

/*
  診断結果の「結論」。装飾ではなく情報階層が主役。
  スコア(何点か)・ポジション(どういう状態か)・解釈(何を意味するか)・
  重点領域(どこを見るか)が、左から右へ一度に読めるように非対称に組む。
  カードを縦に積むのではなく、一枚の表紙として成立させる。
*/
export function ResultHero({
  overallScore,
  message,
  date,
  topDomains,
  positionLabel,
}: {
  overallScore: number;
  message: string;
  date: string;
  topDomains: string[];
  positionLabel?: string;
}) {
  return (
    <Card variant="hero" as="header" className="surface-sheen">
      <div className="absolute -top-28 -right-20 w-72 h-72 rounded-full bg-ice/10 blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-16 w-64 h-64 rounded-full bg-white/[0.04] blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative flex items-baseline justify-between flex-wrap gap-x-4 gap-y-1 animate-rise">
        <p className="lumen-wordmark text-[11px] font-semibold tracking-[0.3em]">LUMEN</p>
        <p className="text-[11px] text-white/45 tabular-nums">{date}</p>
      </div>
      <hr className="rule-fade-light relative mt-4 mb-8 sm:mb-10 animate-rise delay-1" />

      <div className="relative grid gap-8 lg:gap-14 lg:grid-cols-[minmax(0,auto)_1fr] lg:items-start">
        <div className="lg:pr-4 animate-rise delay-2">
          <Metric
            label="Overall position"
            value={overallScore}
            unit="/ 100"
            size="display"
            tone="light"
          />
          {positionLabel && (
            <p className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ice" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-white/75">{positionLabel}</span>
            </p>
          )}
        </div>

        <div className="lg:border-l lg:border-white/10 lg:pl-14 animate-rise delay-3">
          <Eyebrow tone="light" className="mb-3">Financial Risk Profile</Eyebrow>
          <p className="text-lg sm:text-xl leading-relaxed tracking-[-0.01em] text-white/85 max-w-xl">{message}</p>

          {topDomains.length > 0 && (
            <div className="mt-8 sm:mt-9">
              <Eyebrow tone="light" className="mb-4">重点確認領域</Eyebrow>
              <ol className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
                {topDomains.map((label, i) => (
                  <li key={label} className="flex items-baseline gap-3">
                    <span className="font-display-num text-sm font-semibold text-ice/60 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[15px] font-medium text-white">{label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
