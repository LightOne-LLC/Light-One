import type { DiagnosisInput } from '../../types/diagnosis';
import { Card, SectionHeader } from '../ui';

export function PublicProtectionPanel({ basic }: { basic: DiagnosisInput['basic'] }) {
  const isEmployee = basic.occupationType !== 'self_employed';

  const items = [
    {
      label: '遺族年金',
      available: true,
      note: isEmployee ? '遺族基礎年金 + 遺族厚生年金の対象' : '遺族基礎年金のみ(国民年金)',
    },
    {
      label: '傷病手当金',
      available: isEmployee,
      note: isEmployee ? '標準報酬日額の3分の2を最長1年6ヶ月受給可能' : '国民健康保険加入者(自営業)は対象外',
    },
    {
      label: '高額療養費制度',
      available: true,
      note: '所得区分に応じた自己負担上限あり(公的医療保険加入者は全員対象)',
    },
    {
      label: '障害年金',
      available: true,
      note: isEmployee ? '障害基礎年金 + 障害厚生年金の対象' : '障害基礎年金のみ(国民年金)',
    },
    {
      label: '介護保険',
      available: true,
      note: '65歳以上(特定疾病の場合は40歳以上)から自己負担1〜3割で利用可能',
    },
  ];

  return (
    <Card as="section">
      <SectionHeader title="Public Protection" description="職業や働き方によって、利用できる公的保障は異なります。" />

      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-3 py-3">
            <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${item.available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <div>
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">{item.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
