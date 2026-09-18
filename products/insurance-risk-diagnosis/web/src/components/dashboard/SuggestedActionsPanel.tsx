import type { RiskCategoryResult } from '../../types/diagnosis';
import { NEXT_STEPS } from '../../lib/nextSteps';

export function SuggestedActionsPanel({ categories, productTypes }: { categories: RiskCategoryResult[]; productTypes: string[] }) {
  const priority = categories
    .slice()
    .sort((a, b) => b.score - a.score)
    .filter((c) => c.level === 'critical' || c.level === 'high')
    .slice(0, 3);

  const checklist = priority.length > 0 ? priority : categories.slice().sort((a, b) => b.score - a.score).slice(0, 1);

  return (
    <section className="bg-surface rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">Suggested Actions</h2>
      <p className="text-sm text-slate-500 mb-6">
        「保険に入る」ことではなく、「不足しているかもしれないリスクを確認する」ことを次の一歩にしてください。
      </p>

      <div className="space-y-5">
        {checklist.map((c) => (
          <div key={c.key}>
            <p className="text-sm font-semibold text-slate-800 mb-2">{c.label}リスクについて</p>
            <ul className="space-y-2">
              {NEXT_STEPS[c.key].map((step) => (
                <li key={step} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="mt-0.5 w-4 h-4 rounded border border-slate-300 shrink-0" aria-hidden="true" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {productTypes.length > 0 && (
        <details className="mt-6 pt-5 border-t border-slate-100">
          <summary className="cursor-pointer text-sm text-indigo-600 hover:underline select-none">検討の参考になる保障の種類を見る</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {productTypes.map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium ring-1 ring-inset ring-indigo-200">
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            ※特定の保険商品・保険会社を推奨するものではありません。保障の「種類」の目安としてご活用ください。
          </p>
        </details>
      )}
    </section>
  );
}
