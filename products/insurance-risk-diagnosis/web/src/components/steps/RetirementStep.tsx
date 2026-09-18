import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputUnitClass } from './FormField';
import { FieldGroup, FieldRow } from './StepLayout';
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
      <FieldGroup title="Retirement" description="退職の時期と退職金は、老後資金の計算の出発点になります。">
        <FieldRow>
          <FormField label="希望する退職年齢" unit="歳" required emphasis="primary">
            <NumberField min={50} max={90} className={inputUnitClass} value={retirement.desiredRetirementAge} onChange={(n) => update({ desiredRetirementAge: n })} />
          </FormField>

          <FormField
            label="退職金見込み額"
            unit="万円"
            hint="わからない場合は0のままで構いません"
            unknownAction={{ label: 'わからない(0円)', onClick: () => update({ expectedSeverancePay: 0 }) }}
          >
            <NumberField min={0} className={inputUnitClass} value={retirement.expectedSeverancePay} onChange={(n) => update({ expectedSeverancePay: n })} />
          </FormField>
        </FieldRow>
      </FieldGroup>

      <FieldGroup title="Living cost" description="老後・介護・相続は将来推計のため、ここでの入力は「概算」として扱われます。">
        <FormField
          label="老後の希望生活費"
          unit="万円/月"
          hint="未入力の場合は現役時の生活費から概算します"
          unknownAction={{ label: 'わからない(自動概算)', onClick: () => update({ desiredMonthlyLivingCost: undefined }) }}
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputUnitClass}
            placeholder="未入力の場合は自動概算"
            value={retirement.desiredMonthlyLivingCost ?? ''}
            onChange={(e) => update({ desiredMonthlyLivingCost: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </FormField>
      </FieldGroup>
    </div>
  );
}
