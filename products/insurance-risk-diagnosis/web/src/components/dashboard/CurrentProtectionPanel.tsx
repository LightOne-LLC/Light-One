import type { DiagnosisInput } from '../../types/diagnosis';
import { formatManYen } from '../../lib/riskLevelStyle';
import { Card, SectionHeader } from '../ui';

export function CurrentProtectionPanel({ existingInsurance }: { existingInsurance: DiagnosisInput['existingInsurance'] }) {
  const items: { label: string; active: boolean }[] = [
    { label: '医療保険', active: existingInsurance.hasMedicalCoverage },
    { label: 'がん保険', active: existingInsurance.hasCancerCoverage },
    { label: '就業不能保険', active: existingInsurance.hasDisabilityCoverage },
    { label: '介護保険(民間)', active: existingInsurance.hasCareCoverage },
    { label: '個人年金', active: existingInsurance.hasPersonalPension },
    { label: '資産形成型保険', active: existingInsurance.hasSavingsTypeCoverage },
  ];

  return (
    <Card as="section">
      <SectionHeader title="Current Protection" description="現在加入している保障の状況です。" />

      <div className="flex justify-between items-baseline mb-4 pb-4 border-b border-line">
        <span className="text-sm text-ink-muted">現在の死亡保障額</span>
        <span className="text-lg font-semibold tabular-nums text-navy">{formatManYen(existingInsurance.deathCoverage)}</span>
      </div>
      <div className="flex justify-between items-baseline mb-4 pb-4 border-b border-line">
        <span className="text-sm text-ink-muted">月額保険料の合計目安</span>
        <span className="text-lg font-semibold tabular-nums text-navy">{existingInsurance.monthlyPremiumTotal.toLocaleString('ja-JP')}万円/月</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              item.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-canvas text-ink-muted ring-1 ring-inset ring-line'
            }`}
          >
            {item.active ? '✓ ' : ''}{item.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
