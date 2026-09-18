import type { ReactNode } from 'react';

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

/*
  質問ラベルの階層。
  primary は「その設問がそのstepの主題である」ことを示す大きさで組み、
  default は付随する条件設定として控えめに置く。
  すべての設問を同じ text-sm で並べると、フォームは一枚の入力票に見える。
*/
function QuestionLabel({ label, required, emphasis, note }: { label: string; required?: boolean; emphasis: 'primary' | 'default'; note?: string }) {
  if (emphasis === 'primary') {
    return (
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{label}</h3>
          {required && <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-risk-critical">必須</span>}
        </div>
        {note && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{note}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {required ? (
        <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-risk-critical">必須</span>
      ) : (
        <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-ink-faint">任意</span>
      )}
    </div>
  );
}

/*
  選択カード。選択状態を「枠線の色が変わる」で済ませず、面ごと navy material に
  切り替えることで、選んだ結果が画面上の事実として残るようにする。
*/
export function ChoiceCardGroup<T extends string>({
  label, options, value, onChange, required, columns = options.length, emphasis = 'default', note,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
  required?: boolean;
  columns?: number;
  emphasis?: 'primary' | 'default';
  note?: string;
}) {
  return (
    <div className="mb-7">
      <QuestionLabel label={label} required={required} emphasis={emphasis} note={note} />
      <div className={`grid gap-2.5 ${gridColsClass(Math.min(columns, options.length))}`}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
              className={`group relative min-h-[52px] rounded-panel border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                selected
                  ? 'material-navy border-navy-dark text-white shadow-raised edge-highlight-dark'
                  : 'bg-surface border-line text-ink-muted hover:border-line-strong hover:bg-surface-raised'
              }`}
            >
              <span className={`block text-sm font-medium ${selected ? 'text-white' : 'text-ink'}`}>{opt.label}</span>
              {opt.hint && (
                <span className={`block text-xs mt-1 leading-snug ${selected ? 'text-white/60' : 'text-ink-faint'}`}>{opt.hint}</span>
              )}
              {selected && (
                <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-ice" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/*
  複数選択(チェックボックス)。各stepで手書きの<label><input type=checkbox>を
  繰り返さないための共通表現。選択時は左端にplatinumのマーカーが立ち、
  「加入している保障」が台帳の項目のように並ぶ。
*/
export function ChoiceToggle({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 min-h-[52px] px-4 py-3 rounded-panel border cursor-pointer transition-all duration-200 ${
        checked ? 'border-navy/35 bg-platinum-soft' : 'border-line bg-surface hover:bg-surface-raised'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-[18px] h-[18px] rounded-[5px] border-line-strong text-navy focus:ring-navy/30 shrink-0"
      />
      <span className="min-w-0">
        <span className={`block text-sm ${checked ? 'font-medium text-navy' : 'text-ink'}`}>{label}</span>
        {hint && <span className="block text-xs text-ink-faint mt-0.5 leading-snug">{hint}</span>}
      </span>
    </label>
  );
}
