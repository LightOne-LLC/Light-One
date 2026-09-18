import type { DiagnosisInput } from '../../types/diagnosis';
import { FieldGroup } from './StepLayout';
import { ChoiceToggle } from '../ui';

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
      <FieldGroup title="Medical history" description="既往歴は医療リスクの評価に使用します。詳細な病名の入力は不要です。">
        <ChoiceToggle
          checked={health.hasMedicalHistory}
          onChange={(checked) => update({ hasMedicalHistory: checked })}
          label="過去に大きな病気・入院歴などの既往歴がある"
          hint="手術・入院を伴う治療歴、または継続的な通院歴がある場合はチェックしてください"
        />
        <p className="text-xs leading-relaxed text-ink-faint mt-4">
          ここでは簡易チェックのみ行います。詳細な告知内容は実際の保険申込時に確認されます。
        </p>
      </FieldGroup>
    </div>
  );
}
