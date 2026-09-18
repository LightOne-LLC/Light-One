import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass, selectClass } from './FormField';
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
      <h2 className="text-lg font-semibold tracking-tight text-navy mb-1">基本情報</h2>
      <p className="text-sm text-ink-muted mb-5">年齢・世帯構成・収入は、すべてのリスク計算の土台になります。</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label="年齢" required>
          <NumberField min={0} max={120} className={inputClass} value={basic.age} onChange={(n) => updateBasic({ age: n })} />
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

        <FormField label="年収(万円)" required>
          <NumberField min={0} placeholder="例: 500" className={inputClass} value={basic.annualIncome} onChange={(n) => updateBasic({ annualIncome: n })} />
        </FormField>
      </div>

      <ChoiceCardGroup
        label="雇用形態"
        required
        value={basic.occupationType}
        onChange={(v) => updateBasic({ occupationType: v })}
        options={[
          { value: 'employee', label: '会社員' },
          { value: 'public_servant', label: '公務員' },
          { value: 'self_employed', label: '自営業・フリーランス' },
        ]}
        columns={3}
      />
      <p className="text-xs text-ink-muted -mt-4 mb-6">公的保障(傷病手当金・厚生年金等)の有無に影響します</p>

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

      <ChoiceCardGroup
        label="配偶者"
        required
        value={basic.hasSpouse ? 'yes' : 'no'}
        onChange={(v) => updateBasic({ hasSpouse: v === 'yes', spouseAge: v === 'yes' ? basic.spouseAge ?? basic.age : undefined })}
        options={[
          { value: 'no', label: 'いない' },
          { value: 'yes', label: 'いる' },
        ]}
        columns={2}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        {basic.hasSpouse && (
          <FormField label="配偶者の年齢" required>
            <NumberField min={0} max={120} className={inputClass} value={basic.spouseAge ?? 0} onChange={(n) => updateBasic({ spouseAge: n })} />
          </FormField>
        )}

        {basic.hasSpouse && (
          <FormField
            label="配偶者の年収(万円)"
            hint="0の場合は収入なしとして計算します"
            unknownAction={{ label: '不明(0円で計算)', onClick: () => updateBasic({ spouseAnnualIncome: 0 }) }}
          >
            <NumberField min={0} className={inputClass} value={basic.spouseAnnualIncome ?? 0} onChange={(n) => updateBasic({ spouseAnnualIncome: n })} />
          </FormField>
        )}

        <FormField
          label="月間生活費(万円)"
          hint="未入力の場合は年収から簡易的に概算します"
          unknownAction={{ label: 'わからない(自動概算)', onClick: () => updateBasic({ monthlyLivingExpense: undefined }) }}
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            placeholder="未入力の場合は自動概算"
            value={basic.monthlyLivingExpense ?? ''}
            onChange={(e) => updateBasic({ monthlyLivingExpense: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </FormField>
      </div>

      <div className="mt-2 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-navy">子供の人数と年齢</span>
          <button type="button" onClick={addChild} className="text-sm text-navy hover:underline py-1.5 px-1">
            + 子供を追加
          </button>
        </div>
        {basic.children.length === 0 && <p className="text-sm text-ink-muted">子供はいません</p>}
        <div className="space-y-2">
          {basic.children.map((child, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-ink-muted w-14 shrink-0">第{index + 1}子</span>
              <NumberField min={0} max={40} className={inputClass} value={child.currentAge} onChange={(n) => updateChildAge(index, n)} />
              <span className="text-sm text-ink-muted shrink-0">歳</span>
              <button
                type="button"
                onClick={() => removeChild(index)}
                className="text-xs text-rose-500 hover:underline shrink-0 py-2.5 px-1"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>

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
    </div>
  );
}
