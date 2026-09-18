interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

// 320px幅でも3択カードが窮屈にならないよう、狭い画面では2列・sm以上で本来の列数にする。
function gridColsClass(columns: number): string {
  if (columns >= 3) return 'grid-cols-2 sm:grid-cols-3';
  if (columns === 2) return 'grid-cols-2';
  return 'grid-cols-1';
}

// 二択・三択を通常のselectではなく、タップしやすい選択カードとして提示する。
export function ChoiceCardGroup<T extends string>({
  label, options, value, onChange, required, columns = options.length,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
  required?: boolean;
  columns?: number;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {required ? (
          <span className="text-[10px] font-semibold tracking-wide text-rose-500">必須</span>
        ) : (
          <span className="text-[10px] font-medium tracking-wide text-slate-400">任意</span>
        )}
      </div>
      <div className={`grid gap-2 ${gridColsClass(Math.min(columns, options.length))}`}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
              className={`relative min-h-[44px] rounded-xl border px-3 py-2.5 pr-7 text-sm font-medium text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                selected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="block">{opt.label}</span>
              {opt.hint && <span className={`block text-xs mt-0.5 ${selected ? 'text-indigo-500' : 'text-slate-400'}`}>{opt.hint}</span>}
              {selected && (
                <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] leading-none" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
