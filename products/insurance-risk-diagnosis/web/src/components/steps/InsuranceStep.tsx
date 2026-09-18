import type { DiagnosisInput, ExistingInsurance } from '../../types/diagnosis';
import { FormField, inputClass, checkboxClass } from './FormField';
import { NumberField } from '../ui';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

type CoverageFlagKey = {
  [K in keyof ExistingInsurance]: ExistingInsurance[K] extends boolean ? K : never;
}[keyof ExistingInsurance];

const COVERAGE_OPTIONS: { key: CoverageFlagKey; label: string }[] = [
  { key: 'hasMedicalCoverage', label: '医療保険に加入している' },
  { key: 'hasCancerCoverage', label: 'がん保険に加入している' },
  { key: 'hasDisabilityCoverage', label: '就業不能保険に加入している' },
  { key: 'hasCareCoverage', label: '介護保険(民間)に加入している' },
  { key: 'hasPersonalPension', label: '個人年金保険に加入している' },
  { key: 'hasSavingsTypeCoverage', label: '資産形成型の保険に加入している' },
];

export function InsuranceStep({ input, onChange }: Props) {
  const { existingInsurance } = input;
  const update = (patch: Partial<typeof existingInsurance>) => {
    onChange((draft) => ({ ...draft, existingInsurance: { ...draft.existingInsurance, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-navy mb-1">既存保険</h2>
      <p className="text-sm text-ink-muted mb-5">現在加入している保険を確認します。加入していないものは未チェックのままで構いません。</p>

      <FormField
        label="既存の死亡保障額の合計(万円)"
        unknownAction={{ label: '未加入(0円)', onClick: () => update({ deathCoverage: 0 }) }}
      >
        <NumberField min={0} className={inputClass} value={existingInsurance.deathCoverage} onChange={(n) => update({ deathCoverage: n })} />
      </FormField>

      <FormField
        label="現在の月額保険料の合計(万円)"
        hint="生命保険・医療保険等、すべての保険料の合計目安"
        unknownAction={{ label: 'わからない(0円)', onClick: () => update({ monthlyPremiumTotal: 0 }) }}
      >
        <NumberField min={0} step={0.1} inputMode="decimal" className={inputClass} value={existingInsurance.monthlyPremiumTotal} onChange={(n) => update({ monthlyPremiumTotal: n })} />
      </FormField>

      <div className="mt-2 space-y-2">
        {COVERAGE_OPTIONS.map((opt) => {
          const checked = existingInsurance[opt.key];
          return (
            <label
              key={opt.key}
              className={`flex items-center gap-3 min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                checked ? 'border-navy bg-gold-soft text-navy-dark' : 'border-line text-ink-muted hover:border-line hover:bg-canvas'
              }`}
            >
              <input
                type="checkbox"
                className={checkboxClass}
                checked={checked}
                onChange={(e) => update({ [opt.key]: e.target.checked } as Partial<ExistingInsurance>)}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
