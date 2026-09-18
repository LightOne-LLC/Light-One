import type { ReactNode } from 'react';
import { Eyebrow } from './SectionHeader';

export function EmptyState({ message, action, eyebrow = 'No records yet' }: { message: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="material-platinum border border-line-soft rounded-card px-6 py-14 sm:py-20 text-center">
      <Eyebrow className="mb-4">{eyebrow}</Eyebrow>
      <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-ink-muted mb-7">{message}</p>
      {action}
    </div>
  );
}

export function LoadingState({ message = '読み込み中...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20" role="status">
      <span className="flex gap-1.5" aria-hidden="true">
        <span className="w-1 h-1 rounded-full bg-platinum animate-pulse" />
        <span className="w-1 h-1 rounded-full bg-platinum/60 animate-pulse" />
        <span className="w-1 h-1 rounded-full bg-platinum/30 animate-pulse" />
      </span>
      <span className="eyebrow text-ink-faint">{message}</span>
    </div>
  );
}
