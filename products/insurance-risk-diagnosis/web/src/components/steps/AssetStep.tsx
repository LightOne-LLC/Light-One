import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputUnitClass } from './FormField';
import { FieldGroup, FieldRow } from './StepLayout';
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
      {/* 資産と負債は意味が逆向きの情報なので、同じグリッドに混ぜず章を分ける */}
      <FieldGroup title="Assets" description="いま手元にある資産です。おおよその金額で構いません。">
        <FieldRow>
          <FormField
            label="貯蓄額"
            unit="万円"
            emphasis="primary"
            hint="現金・預金等、すぐに使える資産"
            unknownAction={{ label: 'なし(0円)', onClick: () => updateAsset({ savings: 0 }) }}
          >
            <NumberField min={0} placeholder="例: 100" className={inputUnitClass} value={asset.savings} onChange={(n) => updateAsset({ savings: n })} />
          </FormField>

          <FormField
            label="投資性資産"
            unit="万円"
            hint="投資信託・株式等"
            unknownAction={{ label: 'なし(0円)', onClick: () => updateAsset({ otherAssets: 0 }) }}
          >
            <NumberField min={0} className={inputUnitClass} value={asset.otherAssets} onChange={(n) => updateAsset({ otherAssets: n })} />
          </FormField>
        </FieldRow>

        <FormField label="不動産評価額" unit="万円" hint="自宅等の時価の目安。相続財産の概算にも使用します">
          <NumberField min={0} className={inputUnitClass} value={asset.realEstateValue} onChange={(n) => updateAsset({ realEstateValue: n })} />
        </FormField>
      </FieldGroup>

      <FieldGroup title="Liabilities" description="返済中の借入です。万一のときに家族に残る負担として計算に反映されます。">
        <FieldRow>
          <FormField label="住宅ローン残高" unit="万円">
            <NumberField min={0} className={inputUnitClass} value={asset.mortgageBalance} onChange={(n) => updateAsset({ mortgageBalance: n })} />
          </FormField>

          <FormField label="その他借入残高" unit="万円" hint="自動車ローン・カードローン等">
            <NumberField min={0} className={inputUnitClass} value={asset.otherLoanBalance} onChange={(n) => updateAsset({ otherLoanBalance: n })} />
          </FormField>
        </FieldRow>

        {asset.mortgageBalance > 0 && (
          <ChoiceCardGroup
            label="団体信用生命保険(団信)加入"
            note="加入している場合、万一のときに住宅ローン残高は保険で返済されるため、必要保障額から除外されます。"
            value={asset.hasMortgageLifeInsurance ? 'yes' : 'no'}
            onChange={(v) => updateAsset({ hasMortgageLifeInsurance: v === 'yes' })}
            options={[
              { value: 'yes', label: '加入している' },
              { value: 'no', label: '加入していない' },
            ]}
            columns={2}
          />
        )}
      </FieldGroup>
    </div>
  );
}
