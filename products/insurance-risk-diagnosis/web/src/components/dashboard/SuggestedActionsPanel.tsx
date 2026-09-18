import type { RiskCategoryResult } from '../../types/diagnosis';
import { NEXT_STEPS } from '../../lib/nextSteps';
import { Card, SectionHeader } from '../ui';

export function SuggestedActionsPanel({ categories, productTypes }: { categories: RiskCategoryResult[]; productTypes: string[] }) {
  const sorted = categories.slice().sort((a, b) => b.score - a.score);
  const priority = sorted.filter((c) => c.level === 'critical' || c.level === 'high').slice(0, 3);
  const checklist = priority.length > 0 ? priority : sorted.slice(0, 1);
  const rest = sorted.filter((c) => !checklist.includes(c));

  return (
    <Card as="section">
      <SectionHeader
        title="Suggested Actions"
        description="「保険に入る」ことではなく、「不足しているかもしれないリスクを確認する」ことを次の一歩にしてください。"
      />

      <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gold mb-4">Priority</p>
      <ol className="divide-y divide-line">
        {checklist.map((c, i) => (
          <li key={c.key} className="py-5 first:pt-0 last:pb-0">
            <div className="flex items-baseline gap-4">
              <span className="font-display-num text-2xl font-bold text-line shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="text-base font-semibold text-navy mb-2">{c.label}の確認</p>
                <ul className="space-y-1.5">
                  {NEXT_STEPS[c.key].map((step) => (
                    <li key={step} className="flex items-start gap-2 text-sm text-ink-muted">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-gold shrink-0" aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {rest.length > 0 && (
        <details className="mt-6 pt-5 border-t border-line">
          <summary className="cursor-pointer text-sm text-ink-muted hover:text-navy select-none">その他に確認しておきたいこと</summary>
          <ul className="mt-3 space-y-2">
            {rest.map((c) => (
              <li key={c.key} className="flex items-start gap-2.5 text-sm text-ink-muted">
                <span className="mt-0.5 w-4 h-4 rounded border border-line shrink-0" aria-hidden="true" />
                <span>{c.label}: {NEXT_STEPS[c.key][0]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {productTypes.length > 0 && (
        <details className="mt-4 pt-4 border-t border-line">
          <summary className="cursor-pointer text-sm text-navy hover:underline select-none">検討の参考になる保障の種類を見る</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {productTypes.map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-gold-soft text-navy-dark text-sm font-medium ring-1 ring-inset ring-gold-ring">
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-muted mt-3">
            ※特定の保険商品・保険会社を推奨するものではありません。保障の「種類」の目安としてご活用ください。
          </p>
        </details>
      )}
    </Card>
  );
}
