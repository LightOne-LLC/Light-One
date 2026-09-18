import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass, selectClass } from './FormField';

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
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">資産・負債</h2>
      <p className="text-sm text-slate-500 mb-5">いま手元にある資産と、返済中の負債を整理します。おおよその金額で構いません。</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField
          label="貯蓄額(万円)"
          hint="現金・預金等、すぐに使える資産"
          unknownAction={{ label: 'なし(0円)', onClick: () => updateAsset({ savings: 0 }) }}
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            value={asset.savings}
            onChange={(e) => updateAsset({ savings: Number(e.target.value) })}
          />
        </FormField>

        <FormField
          label="投資性資産(万円)"
          hint="投資信託・株式等"
          unknownAction={{ label: 'なし(0円)', onClick: () => updateAsset({ otherAssets: 0 }) }}
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            value={asset.otherAssets}
            onChange={(e) => updateAsset({ otherAssets: Number(e.target.value) })}
          />
        </FormField>

        <FormField label="不動産評価額(万円)" hint="自宅等の時価の目安。相続財産の概算にも使用します">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            value={asset.realEstateValue}
            onChange={(e) => updateAsset({ realEstateValue: Number(e.target.value) })}
          />
        </FormField>

        <FormField label="住宅ローン残高(万円)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            value={asset.mortgageBalance}
            onChange={(e) => updateAsset({ mortgageBalance: Number(e.target.value) })}
          />
        </FormField>

        {asset.mortgageBalance > 0 && (
          <FormField label="団体信用生命保険(団信)加入" hint="加入していれば死亡時にローン残高は保障の対象外になります">
            <select
              className={selectClass}
              value={asset.hasMortgageLifeInsurance ? 'yes' : 'no'}
              onChange={(e) => updateAsset({ hasMortgageLifeInsurance: e.target.value === 'yes' })}
            >
              <option value="yes">加入している</option>
              <option value="no">加入していない</option>
            </select>
          </FormField>
        )}

        <FormField label="その他借入残高(万円)" hint="住宅ローン以外の借入(自動車ローン・カードローン等)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            value={asset.otherLoanBalance}
            onChange={(e) => updateAsset({ otherLoanBalance: Number(e.target.value) })}
          />
        </FormField>
      </div>
    </div>
  );
}
