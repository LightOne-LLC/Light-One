import type { DiagnosisInput } from '../../types/diagnosis';
import { checkboxClass } from './FormField';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function HealthStep({ input, onChange }: Props) {
  const { health } = input;
  const update = (patch: Partial<typeof health>) => {
    onChange((draft) => ({ ...draft, health: { ...draft.health, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">健康状態</h2>
      <p className="text-sm text-slate-500 mb-5">既往歴は医療リスクの評価に使用します。詳細な病名の入力は不要です。</p>
      <label
        className={`flex items-center gap-3 min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
          health.hasMedicalHistory ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <input
          type="checkbox"
          className={checkboxClass}
          checked={health.hasMedicalHistory}
          onChange={(e) => update({ hasMedicalHistory: e.target.checked })}
        />
        過去に大きな病気・入院歴などの既往歴がある
      </label>
      <p className="text-xs text-slate-400 mt-2">
        ここでは簡易チェックのみ行います。詳細な告知内容は実際の保険申込時に確認されます。
      </p>
    </div>
  );
}
