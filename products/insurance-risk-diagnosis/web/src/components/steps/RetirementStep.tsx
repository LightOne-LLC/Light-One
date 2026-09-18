import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass } from './FormField';
import { NumberField } from '../ui';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function RetirementStep({ input, onChange }: Props) {
  const { retirement } = input;
  const update = (patch: Partial<typeof retirement>) => {
    onChange((draft) => ({ ...draft, retirement: { ...draft.retirement, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-navy mb-1">老後の希望</h2>
      <p className="text-sm text-ink-muted mb-5">老後・介護・相続は将来推計のため、ここでの入力は「概算」として扱われます。</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label="希望する退職年齢" required>
          <NumberField min={50} max={90} className={inputClass} value={retirement.desiredRetirementAge} onChange={(n) => update({ desiredRetirementAge: n })} />
        </FormField>

        <FormField
          label="退職金見込み額(万円)"
          hint="わからない場合は0のままで構いません"
          unknownAction={{ label: 'わからない(0円)', onClick: () => update({ expectedSeverancePay: 0 }) }}
        >
          <NumberField min={0} className={inputClass} value={retirement.expectedSeverancePay} onChange={(n) => update({ expectedSeverancePay: n })} />
        </FormField>

        <FormField
          label="老後の希望生活費(万円/月)"
          hint="未入力の場合は現役時の生活費から概算します"
          unknownAction={{ label: 'わからない(自動概算)', onClick: () => update({ desiredMonthlyLivingCost: undefined }) }}
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            placeholder="未入力の場合は自動概算"
            value={retirement.desiredMonthlyLivingCost ?? ''}
            onChange={(e) => update({ desiredMonthlyLivingCost: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </FormField>
      </div>
    </div>
  );
}
