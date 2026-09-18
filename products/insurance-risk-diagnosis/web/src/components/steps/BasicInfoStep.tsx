import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputUnitClass, selectClass } from './FormField';
import { FieldGroup, FieldRow } from './StepLayout';
import { ChoiceCardGroup, NumberField } from '../ui';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function BasicInfoStep({ input, onChange }: Props) {
  const { basic } = input;

  const updateBasic = (patch: Partial<typeof basic>) => {
    onChange((draft) => ({ ...draft, basic: { ...draft.basic, ...patch } }));
  };

  const addChild = () => updateBasic({ children: [...basic.children, { currentAge: 0 }] });
  const removeChild = (index: number) =>
    updateBasic({ children: basic.children.filter((_, i) => i !== index) });
  const updateChildAge = (index: number, age: number) =>
    updateBasic({
      children: basic.children.map((c, i) => (i === index ? { currentAge: age } : c)),
    });

  return (
    <div>
      <FieldGroup title="You" description="年齢と収入は、すべてのリスク計算の基準になります。">
        <FieldRow>
          <FormField label="年齢" unit="歳" required emphasis="primary">
            <NumberField min={0} max={120} className={inputUnitClass} value={basic.age} onChange={(n) => updateBasic({ age: n })} />
          </FormField>

          <FormField label="性別">
            <select
              className={selectClass}
              value={basic.gender}
              onChange={(e) => updateBasic({ gender: e.target.value as typeof basic.gender })}
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </FormField>
        </FieldRow>

        <FormField label="年収" unit="万円" required emphasis="primary" hint="税込みの目安で構いません">
          <NumberField min={0} placeholder="例: 500" className={inputUnitClass} value={basic.annualIncome} onChange={(n) => updateBasic({ annualIncome: n })} />
        </FormField>
      </FieldGroup>

      <FieldGroup title="Work">
        <ChoiceCardGroup
          label="雇用形態"
          required
          emphasis="primary"
          note="傷病手当金・厚生年金など、受けられる公的保障が働き方によって変わります。"
          value={basic.occupationType}
          onChange={(v) => updateBasic({ occupationType: v })}
          options={[
            { value: 'employee', label: '会社員' },
            { value: 'public_servant', label: '公務員' },
            { value: 'self_employed', label: '自営業・フリーランス' },
          ]}
          columns={3}
        />

        <ChoiceCardGroup
          label="職業危険度区分"
          required
          value={basic.occupationRisk}
          onChange={(v) => updateBasic({ occupationRisk: v })}
          options={[
            { value: 'low', label: '低', hint: 'デスクワーク中心' },
            { value: 'mid', label: '中', hint: '外勤中心' },
            { value: 'high', label: '高', hint: '身体を使う作業' },
          ]}
          columns={3}
        />
      </FieldGroup>

      <FieldGroup title="Household" description="家族構成は、万一のときに必要な保障額を大きく左右します。">
        <ChoiceCardGroup
          label="配偶者"
          required
          emphasis="primary"
          value={basic.hasSpouse ? 'yes' : 'no'}
          onChange={(v) => updateBasic({ hasSpouse: v === 'yes', spouseAge: v === 'yes' ? basic.spouseAge ?? basic.age : undefined })}
          options={[
            { value: 'no', label: 'いない' },
            { value: 'yes', label: 'いる' },
          ]}
          columns={2}
        />

        {basic.hasSpouse && (
          <FieldRow>
            <FormField label="配偶者の年齢" unit="歳" required>
              <NumberField min={0} max={120} className={inputUnitClass} value={basic.spouseAge ?? 0} onChange={(n) => updateBasic({ spouseAge: n })} />
            </FormField>

            <FormField
              label="配偶者の年収"
              unit="万円"
              hint="0の場合は収入なしとして計算します"
              unknownAction={{ label: '不明(0円で計算)', onClick: () => updateBasic({ spouseAnnualIncome: 0 }) }}
            >
              <NumberField min={0} className={inputUnitClass} value={basic.spouseAnnualIncome ?? 0} onChange={(n) => updateBasic({ spouseAnnualIncome: n })} />
            </FormField>
          </FieldRow>
        )}

        <FormField
          label="月間生活費"
          unit="万円/月"
          hint="未入力の場合は年収から簡易的に概算します"
          unknownAction={{ label: 'わからない(自動概算)', onClick: () => updateBasic({ monthlyLivingExpense: undefined }) }}
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputUnitClass}
            placeholder="未入力の場合は自動概算"
            value={basic.monthlyLivingExpense ?? ''}
            onChange={(e) => updateBasic({ monthlyLivingExpense: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </FormField>
      </FieldGroup>

      <FieldGroup
        title="Children"
        aside={
          <button type="button" onClick={addChild} className="text-[11px] font-medium text-navy hover:underline underline-offset-2 py-1">
            + 子供を追加
          </button>
        }
      >
        {basic.children.length === 0 ? (
          <p className="text-[13px] text-ink-faint">子供はいません。いる場合は「子供を追加」から年齢を入力してください。</p>
        ) : (
          <ul className="border-t border-line-soft mb-6">
            {basic.children.map((child, index) => (
              <li key={index} className="flex items-center gap-3 py-3 border-b border-line-soft">
                <span className="eyebrow text-ink-faint w-12 shrink-0">第{index + 1}子</span>
                <span className="relative flex-1 min-w-0">
                  <NumberField min={0} max={40} className={inputUnitClass} value={child.currentAge} onChange={(n) => updateChildAge(index, n)} />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] text-ink-faint">歳</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeChild(index)}
                  className="shrink-0 text-xs text-ink-faint hover:text-risk-critical transition-colors min-h-[44px] px-2"
                  aria-label={`第${index + 1}子を削除`}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}

        {basic.children.length > 0 && (
          <FormField label="想定する教育コース" hint="必要保障額の教育費試算に使用します">
            <select
              className={selectClass}
              value={basic.educationCourse}
              onChange={(e) => updateBasic({ educationCourse: e.target.value as typeof basic.educationCourse })}
            >
              <option value="all_public">すべて公立</option>
              <option value="public_then_private_univ">高校まで公立・大学は私立</option>
              <option value="all_private">すべて私立</option>
            </select>
          </FormField>
        )}
      </FieldGroup>
    </div>
  );
}
