import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
  unknownAction?: { label: string; onClick: () => void };
}

export function FormField({ label, children, hint, required, error, unknownAction }: FormFieldProps) {
  return (
    <label className="block mb-6">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required ? (
            <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-rose-500 align-middle">必須</span>
          ) : (
            <span className="ml-1.5 text-[10px] font-medium tracking-wide text-slate-400 align-middle">任意</span>
          )}
        </span>
        {unknownAction && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              unknownAction.onClick();
            }}
            className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0 py-0.5"
          >
            {unknownAction.label}
          </button>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-rose-600 mt-1.5" role="alert">{error}</p>}
      {!error && hint && <span className="block text-xs text-slate-400 mt-1.5">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500';
export const inputErrorClass =
  'w-full min-h-[44px] rounded-lg border border-rose-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500';
export const selectClass = inputClass;
export const checkboxClass = 'w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40 shrink-0';
