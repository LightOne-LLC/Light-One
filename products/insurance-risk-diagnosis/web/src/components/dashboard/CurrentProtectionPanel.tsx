import type { DiagnosisInput } from '../../types/diagnosis';
import { splitManYen } from '../../lib/riskLevelStyle';
import { Card, SectionHeader, Metric } from '../ui';

/*
  現在の備え。チップの雲ではなく、加入状況の台帳として並べる。
  「入っている / 入っていない」は色ではなく、行の濃度と右端の記号で示す。
*/
export function CurrentProtectionPanel({ existingInsurance }: { existingInsurance: DiagnosisInput['existingInsurance'] }) {
  const items: { label: string; active: boolean }[] = [
    { label: '医療保険', active: existingInsurance.hasMedicalCoverage },
    { label: 'がん保険', active: existingInsurance.hasCancerCoverage },
    { label: '就業不能保険', active: existingInsurance.hasDisabilityCoverage },
    { label: '介護保険(民間)', active: existingInsurance.hasCareCoverage },
    { label: '個人年金', active: existingInsurance.hasPersonalPension },
    { label: '資産形成型保険', active: existingInsurance.hasSavingsTypeCoverage },
  ];
  const death = splitManYen(existingInsurance.deathCoverage);
  const activeCount = items.filter((i) => i.active).length;

  return (
    <Card as="section" variant="panel">
      <SectionHeader eyebrow="Your cover" title="Current Protection" description="現在加入している保障の状況です。" />

      <div className="material-brushed border border-line-soft rounded-panel p-4 sm:p-5 mb-5 grid grid-cols-2 gap-4">
        <Metric label="死亡保障額" value={death.value} unit={death.unit} size="md" />
        <Metric
          label="月額保険料"
          value={existingInsurance.monthlyPremiumTotal.toLocaleString('ja-JP')}
          unit="万円/月"
          size="md"
          tone="muted"
        />
      </div>

      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="eyebrow text-ink-faint">加入状況</span>
        <span className="text-[11px] tabular-nums text-ink-faint">{activeCount} / {items.length}</span>
      </div>
      <ul>
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0"
          >
            <span className={`text-[13px] ${item.active ? 'font-medium text-ink' : 'text-ink-faint'}`}>{item.label}</span>
            {item.active ? (
              <span className="text-[11px] font-medium tracking-[0.08em] text-risk-low">加入</span>
            ) : (
              <span className="text-[11px] text-ink-faint" aria-label="未加入">—</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
