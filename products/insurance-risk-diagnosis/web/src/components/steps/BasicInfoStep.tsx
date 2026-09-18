import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass, selectClass } from './FormField';

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
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-5">基本情報</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label="年齢">
          <input
            type="number"
            min={0}
            max={120}
            className={inputClass}
            value={basic.age}
            onChange={(e) => updateBasic({ age: Number(e.target.value) })}
          />
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

        <FormField label="雇用形態">
          <select
            className={selectClass}
            value={basic.occupationType}
            onChange={(e) => updateBasic({ occupationType: e.target.value as typeof basic.occupationType })}
          >
            <option value="employee">会社員</option>
            <option value="public_servant">公務員</option>
            <option value="self_employed">自営業・フリーランス</option>
          </select>
        </FormField>

        <FormField label="職業危険度区分" hint="デスクワーク中心=低、外勤中心=中、身体を使う作業=高">
          <select
            className={selectClass}
            value={basic.occupationRisk}
            onChange={(e) => updateBasic({ occupationRisk: e.target.value as typeof basic.occupationRisk })}
          >
            <option value="low">低</option>
            <option value="mid">中</option>
            <option value="high">高</option>
          </select>
        </FormField>

        <FormField label="年収(万円)">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={basic.annualIncome}
            onChange={(e) => updateBasic({ annualIncome: Number(e.target.value) })}
          />
        </FormField>

        <FormField label="配偶者">
          <select
            className={selectClass}
            value={basic.hasSpouse ? 'yes' : 'no'}
            onChange={(e) => updateBasic({ hasSpouse: e.target.value === 'yes', spouseAge: e.target.value === 'yes' ? basic.spouseAge ?? basic.age : undefined })}
          >
            <option value="no">いない</option>
            <option value="yes">いる</option>
          </select>
        </FormField>

        {basic.hasSpouse && (
          <FormField label="配偶者の年齢">
            <input
              type="number"
              min={0}
              max={120}
              className={inputClass}
              value={basic.spouseAge ?? ''}
              onChange={(e) => updateBasic({ spouseAge: Number(e.target.value) })}
            />
          </FormField>
        )}

        {basic.hasSpouse && (
          <FormField label="配偶者の年収(万円)" hint="0の場合は収入なしとして計算します">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={basic.spouseAnnualIncome ?? 0}
              onChange={(e) => updateBasic({ spouseAnnualIncome: Number(e.target.value) })}
            />
          </FormField>
        )}

        <FormField label="月間生活費(万円)" hint="未入力の場合は年収から簡易的に概算します">
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="未入力の場合は自動概算"
            value={basic.monthlyLivingExpense ?? ''}
            onChange={(e) => updateBasic({ monthlyLivingExpense: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </FormField>
      </div>

      <div className="mt-2 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">子供の人数と年齢</span>
          <button type="button" onClick={addChild} className="text-sm text-indigo-600 hover:underline">
            + 子供を追加
          </button>
        </div>
        {basic.children.length === 0 && <p className="text-sm text-slate-400">子供はいません</p>}
        <div className="space-y-2">
          {basic.children.map((child, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-slate-600 w-16">第{index + 1}子</span>
              <input
                type="number"
                min={0}
                max={40}
                className={inputClass}
                value={child.currentAge}
                onChange={(e) => updateChildAge(index, Number(e.target.value))}
              />
              <span className="text-sm text-slate-500">歳</span>
              <button type="button" onClick={() => removeChild(index)} className="text-xs text-red-500 hover:underline">
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
