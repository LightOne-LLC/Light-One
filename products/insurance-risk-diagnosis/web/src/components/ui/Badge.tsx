import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'outline';

/*
  Badgeは「丸いピル」を量産する装置にしない。
  outlineは罫線のみの静かな表示で、一覧に多数並べても画面が賑やかにならない。
*/
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-raised text-ink-muted ring-1 ring-inset ring-line-soft',
  accent: 'bg-platinum-soft text-navy ring-1 ring-inset ring-platinum-ring',
  success: 'bg-risk-low-soft text-risk-low ring-1 ring-inset ring-risk-low-ring',
  outline: 'text-ink-muted ring-1 ring-inset ring-line',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium tracking-[0.02em] ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/*
  リスクレベル表示。バッジの中でも「状態」を示すものは、
  ラベル文字を小さく・字間を広く取り、計器の表示のように見せる。
*/
export function StatusChip({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}>
      {label}
    </span>
  );
}
