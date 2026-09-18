import type { ReactNode } from 'react';

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-5">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1.5">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500';
export const selectClass = inputClass;
export const checkboxLabelClass = 'flex items-center gap-2.5 text-sm text-slate-700 py-1.5';
export const checkboxClass = 'w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40';
