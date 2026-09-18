import type { DiagnosisInput } from '../../types/diagnosis';
import { formatManYen } from '../../lib/riskLevelStyle';

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
    <section className="bg-surface rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">Current Protection</h2>
      <p className="text-sm text-slate-500 mb-6">現在加入している保障の状況です。</p>

      <div className="flex justify-between items-baseline mb-4 pb-4 border-b border-slate-100">
        <span className="text-sm text-slate-500">現在の死亡保障額</span>
        <span className="text-lg font-semibold tabular-nums text-slate-900">{formatManYen(existingInsurance.deathCoverage)}</span>
      </div>
      <div className="flex justify-between items-baseline mb-4 pb-4 border-b border-slate-100">
        <span className="text-sm text-slate-500">月額保険料の合計目安</span>
        <span className="text-lg font-semibold tabular-nums text-slate-900">{existingInsurance.monthlyPremiumTotal.toLocaleString('ja-JP')}万円/月</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              item.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200'
            }`}
          >
            {item.active ? '✓ ' : ''}{item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
