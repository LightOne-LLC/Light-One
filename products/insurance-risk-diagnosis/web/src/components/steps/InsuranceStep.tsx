import type { DiagnosisInput, ExistingInsurance } from '../../types/diagnosis';
import { FormField, inputUnitClass } from './FormField';
import { FieldGroup } from './StepLayout';
import { ChoiceToggle, NumberField } from '../ui';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

type CoverageFlagKey = {
  [K in keyof ExistingInsurance]: ExistingInsurance[K] extends boolean ? K : never;
}[keyof ExistingInsurance];

const COVERAGE_OPTIONS: { key: CoverageFlagKey; label: string; hint: string }[] = [
  { key: 'hasMedicalCoverage', label: '医療保険', hint: '入院・手術時の給付' },
  { key: 'hasCancerCoverage', label: 'がん保険', hint: 'がん診断時の一時金・治療給付' },
  { key: 'hasDisabilityCoverage', label: '就業不能保険', hint: '働けない期間の収入補填' },
  { key: 'hasCareCoverage', label: '介護保険(民間)', hint: '公的介護保険の自己負担分に備える' },
  { key: 'hasPersonalPension', label: '個人年金保険', hint: '老後の受取原資' },
  { key: 'hasSavingsTypeCoverage', label: '資産形成型の保険', hint: '終身・養老など貯蓄性のあるもの' },
];

export function InsuranceStep({ input, onChange }: Props) {
  const { existingInsurance } = input;
  const update = (patch: Partial<typeof existingInsurance>) => {
    onChange((draft) => ({ ...draft, existingInsurance: { ...draft.existingInsurance, ...patch } }));
  };
  const activeCount = COVERAGE_OPTIONS.filter((o) => existingInsurance[o.key]).length;

  return (
    <div>
      <FieldGroup title="Death cover" description="すでに用意できている死亡保障は、必要保障額からそのまま差し引かれます。">
        <FormField
          label="既存の死亡保障額の合計"
          unit="万円"
          emphasis="primary"
          unknownAction={{ label: '未加入(0円)', onClick: () => update({ deathCoverage: 0 }) }}
        >
          <NumberField min={0} className={inputUnitClass} value={existingInsurance.deathCoverage} onChange={(n) => update({ deathCoverage: n })} />
        </FormField>
      </FieldGroup>

      <FieldGroup title="Premium">
        <FormField
          label="現在の月額保険料の合計"
          unit="万円/月"
          hint="生命保険・医療保険等、すべての保険料の合計目安"
          unknownAction={{ label: 'わからない(0円)', onClick: () => update({ monthlyPremiumTotal: 0 }) }}
        >
          <NumberField
            min={0}
            step={0.1}
            inputMode="decimal"
            className={inputUnitClass}
            value={existingInsurance.monthlyPremiumTotal}
            onChange={(n) => update({ monthlyPremiumTotal: n })}
          />
        </FormField>
      </FieldGroup>

      {/* 加入中の保障は「台帳のチェック」。1列の縦積みではなく2列に組み、一覧として把握できるようにする */}
      <FieldGroup
        title="Coverage in force"
        description="加入していないものは未チェックのままで構いません。"
        aside={<span className="text-[11px] tabular-nums text-ink-faint">{activeCount} / {COVERAGE_OPTIONS.length}</span>}
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {COVERAGE_OPTIONS.map((opt) => (
            <ChoiceToggle
              key={opt.key}
              checked={existingInsurance[opt.key]}
              onChange={(checked) => update({ [opt.key]: checked } as Partial<ExistingInsurance>)}
              label={opt.label}
              hint={opt.hint}
            />
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}
