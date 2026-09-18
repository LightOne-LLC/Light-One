import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass, checkboxLabelClass, checkboxClass } from './FormField';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function InsuranceStep({ input, onChange }: Props) {
  const { existingInsurance } = input;
  const update = (patch: Partial<typeof existingInsurance>) => {
    onChange((draft) => ({ ...draft, existingInsurance: { ...draft.existingInsurance, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">既存保険</h2>
      <p className="text-sm text-slate-500 mb-5">現在加入している保険を確認します。加入していないものは未チェックのままで構いません。</p>

      <FormField
        label="既存の死亡保障額の合計(万円)"
        unknownAction={{ label: '未加入(0円)', onClick: () => update({ deathCoverage: 0 }) }}
      >
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className={inputClass}
          value={existingInsurance.deathCoverage}
          onChange={(e) => update({ deathCoverage: Number(e.target.value) })}
        />
      </FormField>

      <FormField
        label="現在の月額保険料の合計(万円)"
        hint="生命保険・医療保険等、すべての保険料の合計目安"
        unknownAction={{ label: 'わからない(0円)', onClick: () => update({ monthlyPremiumTotal: 0 }) }}
      >
        <input
          type="number"
          min={0}
          step={0.1}
          inputMode="decimal"
          className={inputClass}
          value={existingInsurance.monthlyPremiumTotal}
          onChange={(e) => update({ monthlyPremiumTotal: Number(e.target.value) })}
        />
      </FormField>

      <div className="mt-2 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <label className={`${checkboxLabelClass} px-4`}>
          <input
            type="checkbox"
            className={checkboxClass}
            checked={existingInsurance.hasMedicalCoverage}
            onChange={(e) => update({ hasMedicalCoverage: e.target.checked })}
          />
          医療保険に加入している
        </label>
        <label className={`${checkboxLabelClass} px-4`}>
          <input
            type="checkbox"
            className={checkboxClass}
            checked={existingInsurance.hasCancerCoverage}
            onChange={(e) => update({ hasCancerCoverage: e.target.checked })}
          />
          がん保険に加入している
        </label>
        <label className={`${checkboxLabelClass} px-4`}>
          <input
            type="checkbox"
            className={checkboxClass}
            checked={existingInsurance.hasDisabilityCoverage}
            onChange={(e) => update({ hasDisabilityCoverage: e.target.checked })}
          />
          就業不能保険に加入している
        </label>
        <label className={`${checkboxLabelClass} px-4`}>
          <input
            type="checkbox"
            className={checkboxClass}
            checked={existingInsurance.hasCareCoverage}
            onChange={(e) => update({ hasCareCoverage: e.target.checked })}
          />
          介護保険(民間)に加入している
        </label>
        <label className={`${checkboxLabelClass} px-4`}>
          <input
            type="checkbox"
            className={checkboxClass}
            checked={existingInsurance.hasPersonalPension}
            onChange={(e) => update({ hasPersonalPension: e.target.checked })}
          />
          個人年金保険に加入している
        </label>
        <label className={`${checkboxLabelClass} px-4`}>
          <input
            type="checkbox"
            className={checkboxClass}
            checked={existingInsurance.hasSavingsTypeCoverage}
            onChange={(e) => update({ hasSavingsTypeCoverage: e.target.checked })}
          />
          資産形成型の保険に加入している
        </label>
      </div>
    </div>
  );
}
