import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass } from './FormField';

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
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-5">老後の希望</h2>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="希望する退職年齢">
          <input
            type="number"
            min={50}
            max={90}
            className={inputClass}
            value={retirement.desiredRetirementAge}
            onChange={(e) => update({ desiredRetirementAge: Number(e.target.value) })}
          />
        </FormField>

        <FormField label="退職金見込み額(万円)" hint="わからない場合は0のままで構いません">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={retirement.expectedSeverancePay}
            onChange={(e) => update({ expectedSeverancePay: Number(e.target.value) })}
          />
        </FormField>

        <FormField label="老後の希望生活費(万円/月)" hint="未入力の場合は現役時の生活費から概算します">
          <input
            type="number"
            min={0}
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
