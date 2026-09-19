import type { RiskCategoryResult, RiskCategoryKey } from '../../types/diagnosis';
import { NEXT_STEPS } from '../../lib/nextSteps';
import { riskLevelStyle } from '../../lib/riskLevelStyle';
import { buildActionEvidence } from '../../rag';
import { Card, SectionHeader, StatusChip, Eyebrow } from '../ui';

// 各アクションが「何を達成するための確認なのか」。手順だけを並べると作業リストになり、
// 判断材料にならないため、目的を1行で併記する。
const PURPOSE: Record<RiskCategoryKey, string> = {
  death: '万一のときに、家族の生活費と教育費が途切れない状態にする。',
  medical: '治療が長引いても、手元の現金が尽きない状態にする。',
  disability: '働けない期間に生じる収入の空白を埋める。',
  retirement: '退職後の生活費が、資産の取り崩しだけに依存しない状態にする。',
  care: '介護が始まったときに、現役世代の家計が圧迫されない状態にする。',
  asset: '資産が物価上昇に対して目減りしない形で積み上がる状態にする。',
  inheritance: '相続時に、納税資金と分け方で家族が困らない状態にする。',
};

export function SuggestedActionsPanel({ categories, productTypes }: { categories: RiskCategoryResult[]; productTypes: string[] }) {
  const sorted = categories.slice().sort((a, b) => b.score - a.score);
  const priority = sorted.filter((c) => c.level === 'critical' || c.level === 'high').slice(0, 3);
  const checklist = priority.length > 0 ? priority : sorted.slice(0, 1);
  const rest = sorted.filter((c) => !checklist.includes(c));

  return (
    <Card as="section" variant="feature">
      <SectionHeader
        variant="editorial"
        eyebrow="Next Steps"
        title="Suggested Actions"
        description="「保険に入る」ことではなく、「不足しているかもしれないリスクを確認する」ことを次の一歩にしてください。"
      />

      <ol className="space-y-7">
        {checklist.map((c, i) => {
          const style = riskLevelStyle(c.level);
          // 各確認事項(NEXT_STEPS)がどの根拠資料に基づくかを追跡できるようにする。
          // NEXT_STEPS自体の内容・順序・優先度は変更しない — 表示のみの追加情報。
          const stepEvidence = buildActionEvidence(c.key, NEXT_STEPS[c.key]);
          return (
            <li key={c.key} className="grid grid-cols-[auto_1fr] gap-x-4 sm:gap-x-6">
              <span className="font-display-num text-2xl sm:text-3xl font-bold leading-none text-line-strong tabular-nums pt-1" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap mb-2">
                  <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{c.label}の確認</h3>
                  <StatusChip label={style.label} className={style.badgeClass} />
                </div>

                {c.reasons[0] && (
                  <p className="text-[13px] leading-relaxed text-ink-muted mb-4">
                    <span className="text-ink-faint">なぜ — </span>
                    {c.reasons[0]}
                  </p>
                )}

                <div className="material-brushed border border-line-soft rounded-panel p-4 sm:p-5">
                  <Eyebrow className="mb-3">確認すること</Eyebrow>
                  <ul className="space-y-2">
                    {NEXT_STEPS[c.key].map((step, stepIndex) => {
                      const source = stepEvidence[stepIndex]?.sources[0];
                      return (
                        <li key={step} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
                          <span className="mt-[7px] w-3 h-px bg-platinum shrink-0" aria-hidden="true" />
                          <span className="min-w-0">
                            {step}
                            {source && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="ml-2 text-[11px] text-ink-faint hover:text-navy underline underline-offset-2 whitespace-nowrap"
                              >
                                出典: {source.organization}
                              </a>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <hr className="rule-fade my-4" />
                  <p className="text-xs leading-relaxed text-ink-muted">
                    <span className="eyebrow text-ink-faint mr-2">目的</span>
                    {PURPOSE[c.key]}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {rest.length > 0 && (
        <details className="mt-8 pt-6 border-t border-line">
          <summary className="cursor-pointer text-[13px] text-ink-muted hover:text-ink select-none">その他に確認しておきたいこと</summary>
          <ul className="mt-4 space-y-2.5">
            {rest.map((c) => (
              <li key={c.key} className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-muted">
                <span className="mt-[7px] w-3 h-px bg-line-strong shrink-0" aria-hidden="true" />
                <span><span className="font-medium text-ink">{c.label}</span>: {NEXT_STEPS[c.key][0]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {productTypes.length > 0 && (
        <details className="mt-4 pt-4 border-t border-line">
          <summary className="cursor-pointer text-[13px] text-navy hover:underline select-none">検討の参考になる保障の種類を見る</summary>
          <div className="mt-4 flex flex-wrap gap-2">
            {productTypes.map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-platinum-soft text-navy text-[13px] font-medium ring-1 ring-inset ring-platinum-ring">
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-ink-faint mt-3">
            ※特定の保険商品・保険会社を推奨するものではありません。保障の「種類」の目安としてご活用ください。
          </p>
        </details>
      )}
    </Card>
  );
}
