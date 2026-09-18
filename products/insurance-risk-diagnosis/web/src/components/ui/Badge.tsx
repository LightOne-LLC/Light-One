import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'success';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-muted ring-1 ring-inset ring-line',
  accent: 'bg-gold-soft text-navy-dark ring-1 ring-inset ring-gold-ring',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${TONE_CLASS[tone]}`}>{children}</span>;
}
