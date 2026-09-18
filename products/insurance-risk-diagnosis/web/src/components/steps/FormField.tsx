import type { ReactNode } from 'react';

/*
  入力欄の面。事務フォームの薄い枠線ではなく、白い面に静かな境界と
  フォーカス時のリングを持たせる。数値は tabular-nums で桁を揃え、
  金額としてまっすぐ読めるようにする。
*/
export const inputClass =
  'w-full min-h-[48px] rounded-control border border-line bg-surface px-4 py-3 text-base sm:text-[15px] text-ink tabular-nums transition-all duration-200 placeholder:text-ink-faint/70 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/15';

/** 単位ラベルを重ねる入力欄用。右側に単位分の余白を確保する */
export const inputUnitClass = `${inputClass} pr-16`;

export const selectClass = inputClass;

/*
  設問の重み付け。primary はそのstepの主要な問いとして大きく、
  default は付随条件として控えめに組む。すべて同じ大きさで並べると
  「記入項目の一覧」になり、判断の順序が伝わらない。
*/
export function FormField({
  label,
  unit,
  required,
  hint,
  error,
  children,
  unknownAction,
  emphasis = 'default',
}: {
  label: string;
  unit?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  unknownAction?: { label: string; onClick: () => void };
  emphasis?: 'primary' | 'default';
}) {
  return (
    <label className="block mb-6">
      <span className="flex items-baseline justify-between gap-3 mb-2">
        <span className="flex items-baseline gap-2 min-w-0">
          <span className={emphasis === 'primary' ? 'text-[17px] font-semibold tracking-[-0.01em] text-ink' : 'text-sm font-medium text-ink'}>
            {label}
          </span>
          {required ? (
            <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-risk-critical shrink-0">必須</span>
          ) : (
            <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-ink-faint shrink-0">任意</span>
          )}
        </span>
        {unknownAction && (
          <button
            type="button"
            onClick={unknownAction.onClick}
            className="shrink-0 text-[11px] text-ink-muted hover:text-navy underline underline-offset-2 decoration-line-strong py-1"
          >
            {unknownAction.label}
          </button>
        )}
      </span>

      <span className="relative block">
        {children}
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] text-ink-faint">{unit}</span>
        )}
      </span>

      {error ? (
        <span className="block text-xs text-risk-critical mt-1.5">{error}</span>
      ) : hint ? (
        <span className="block text-xs leading-relaxed text-ink-faint mt-1.5">{hint}</span>
      ) : null}
    </label>
  );
}
