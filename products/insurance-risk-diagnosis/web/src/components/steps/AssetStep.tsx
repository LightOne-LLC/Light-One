import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass } from './FormField';
import { ChoiceCardGroup, NumberField } from '../ui';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function AssetStep({ input, onChange }: Props) {
  const { asset } = input;
  const updateAsset = (patch: Partial<typeof asset>) => {
    onChange((draft) => ({ ...draft, asset: { ...draft.asset, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-navy mb-1">資産・負債</h2>
      <p className="text-sm text-ink-muted mb-5">いま手元にある資産と、返済中の負債を整理します。おおよその金額で構いません。</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField
          label="貯蓄額(万円)"
          hint="現金・預金等、すぐに使える資産"
          unknownAction={{ label: 'なし(0円)', onClick: () => updateAsset({ savings: 0 }) }}
        >
          <NumberField min={0} placeholder="例: 100" className={inputClass} value={asset.savings} onChange={(n) => updateAsset({ savings: n })} />
        </FormField>

        <FormField
          label="投資性資産(万円)"
          hint="投資信託・株式等"
          unknownAction={{ label: 'なし(0円)', onClick: () => updateAsset({ otherAssets: 0 }) }}
        >
          <NumberField min={0} className={inputClass} value={asset.otherAssets} onChange={(n) => updateAsset({ otherAssets: n })} />
        </FormField>

        <FormField label="不動産評価額(万円)" hint="自宅等の時価の目安。相続財産の概算にも使用します">
          <NumberField min={0} className={inputClass} value={asset.realEstateValue} onChange={(n) => updateAsset({ realEstateValue: n })} />
        </FormField>

        <FormField label="住宅ローン残高(万円)">
          <NumberField min={0} className={inputClass} value={asset.mortgageBalance} onChange={(n) => updateAsset({ mortgageBalance: n })} />
        </FormField>

        <FormField label="その他借入残高(万円)" hint="住宅ローン以外の借入(自動車ローン・カードローン等)">
          <NumberField min={0} className={inputClass} value={asset.otherLoanBalance} onChange={(n) => updateAsset({ otherLoanBalance: n })} />
        </FormField>
      </div>

      {asset.mortgageBalance > 0 && (
        <ChoiceCardGroup
          label="団体信用生命保険(団信)加入"
          value={asset.hasMortgageLifeInsurance ? 'yes' : 'no'}
          onChange={(v) => updateAsset({ hasMortgageLifeInsurance: v === 'yes' })}
          options={[
            { value: 'yes', label: '加入している' },
            { value: 'no', label: '加入していない' },
          ]}
          columns={2}
        />
      )}
    </div>
  );
}
