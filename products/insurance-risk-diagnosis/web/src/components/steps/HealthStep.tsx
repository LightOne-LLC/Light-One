import type { DiagnosisInput } from '../../types/diagnosis';
import { checkboxLabelClass, checkboxClass } from './FormField';

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
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-5">健康状態</h2>
      <label className={checkboxLabelClass}>
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
