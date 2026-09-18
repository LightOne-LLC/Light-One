import { useState } from 'react';
import type { RiskCategoryResult } from '../../types/diagnosis';
import { riskLevelStyle } from '../../lib/riskLevelStyle';

function WhyItem({ category, defaultOpen }: { category: RiskCategoryResult; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const style = riskLevelStyle(category.level);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>{style.label}</span>
          <span className="text-sm font-semibold text-slate-900">{category.label}リスク</span>
        </span>
        <span className="text-slate-400 text-sm">{open ? '閉じる' : '詳細を見る'}</span>
      </button>
      {open && (
        <ul className="px-5 pb-4 space-y-1.5 text-sm text-slate-600 animate-fade-in">
          {category.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-slate-300 shrink-0">・</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WhyPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const sorted = categories.slice().sort((a, b) => b.score - a.score);
  return (
    <section className="bg-surface rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">Why?</h2>
      <p className="text-sm text-slate-500 mb-6">各リスクについて、入力内容からどのように判定したかを確認できます。</p>
      <div className="space-y-3">
        {sorted.map((c, i) => (
          <WhyItem key={c.key} category={c} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}
