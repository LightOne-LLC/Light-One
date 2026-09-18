import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'success';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
  accent: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${TONE_CLASS[tone]}`}>{children}</span>;
}
