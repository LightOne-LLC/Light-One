import type { ReactNode } from 'react';

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
      <p className="text-sm text-slate-400 mb-4">{message}</p>
      {action}
    </div>
  );
}

export function LoadingState({ message = '読み込み中...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
