import type { DiagnosisInput } from '../../types/diagnosis';
import { Eyebrow, Metric } from '../ui';

function occupationLabel(t: string): string {
  if (t === 'employee') return '会社員';
  if (t === 'public_servant') return '公務員';
  return '自営業・フリーランス';
}

function genderLabel(g: string): string {
  if (g === 'male') return '男性';
  if (g === 'female') return '女性';
  return 'その他';
}

function riskLabel(r: string): string {
  if (r === 'low') return '低(デスクワーク中心)';
  if (r === 'mid') return '中(外勤中心)';
  return '高(身体を使う作業)';
}

function educationLabel(c: string): string {
  if (c === 'all_public') return 'すべて公立';
  if (c === 'public_then_private_univ') return '高校まで公立・大学は私立';
  return 'すべて私立';
}

interface Row {
  label: string;
  value: string;
}

/*
  診断前の確認は「入力値の一覧」ではなく、自分のFinancial Profileのレビュー。
  カテゴリごとに、そのカテゴリを代表する数値を1つ大きく見せ、
  残りを台帳として下に置く。編集導線はカテゴリ単位で常に見える位置に出す。
*/
function ProfileGroup({
  eyebrow,
  title,
  headline,
  rows,
  onEdit,
}: {
  eyebrow: string;
  title: string;
  headline?: { label: string; value: string | number; unit?: string };
  rows: Row[];
  onEdit: () => void;
}) {
  return (
    <section className="material-brushed border border-line-soft rounded-panel p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-[11px] font-medium text-navy hover:underline underline-offset-2 min-h-[36px] px-1"
        >
          編集
        </button>
      </div>

      {headline && (
        <div className="pb-4 mb-3 border-b border-line-soft">
          <Metric label={headline.label} value={headline.value} unit={headline.unit} size="md" />
        </div>
      )}

      <dl>
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 py-1.5">
            <dt className="text-[13px] text-ink-muted shrink-0">{r.label}</dt>
            <dd className="text-[13px] font-medium tabular-nums text-ink text-right min-w-0">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ConfirmStep({ input, onEditStep }: { input: DiagnosisInput; onEditStep: (step: number) => void }) {
  const { basic, asset, existingInsurance, health, retirement } = input;

  const coverages = [
    existingInsurance.hasMedicalCoverage && '医療',
    existingInsurance.hasCancerCoverage && 'がん',
    existingInsurance.hasDisabilityCoverage && '就業不能',
    existingInsurance.hasCareCoverage && '介護',
    existingInsurance.hasPersonalPension && '個人年金',
    existingInsurance.hasSavingsTypeCoverage && '資産形成',
  ].filter(Boolean) as string[];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileGroup
          eyebrow="Basic profile"
          title="本人"
          headline={{ label: '年収', value: basic.annualIncome.toLocaleString('ja-JP'), unit: '万円' }}
          rows={[
            { label: '年齢', value: `${basic.age}歳` },
            { label: '性別', value: genderLabel(basic.gender) },
            { label: '雇用形態', value: occupationLabel(basic.occupationType) },
            { label: '職業危険度', value: riskLabel(basic.occupationRisk) },
          ]}
          onEdit={() => onEditStep(0)}
        />

        <ProfileGroup
          eyebrow="Family"
          title="世帯"
          headline={{
            label: '月間生活費',
            value: basic.monthlyLivingExpense === undefined ? '自動概算' : basic.monthlyLivingExpense.toLocaleString('ja-JP'),
            unit: basic.monthlyLivingExpense === undefined ? undefined : '万円/月',
          }}
          rows={[
            {
              label: '配偶者',
              value: basic.hasSpouse ? `いる(${basic.spouseAge}歳・年収${basic.spouseAnnualIncome ?? 0}万円)` : 'いない',
            },
            {
              label: '子供',
              value: basic.children.length ? basic.children.map((c) => `${c.currentAge}歳`).join(' / ') : 'いない',
            },
            ...(basic.children.length ? [{ label: '教育コース', value: educationLabel(basic.educationCourse) }] : []),
          ]}
          onEdit={() => onEditStep(0)}
        />

        <ProfileGroup
          eyebrow="Assets"
          title="資産・負債"
          headline={{ label: '貯蓄額', value: asset.savings.toLocaleString('ja-JP'), unit: '万円' }}
          rows={[
            { label: '投資性資産', value: `${asset.otherAssets.toLocaleString('ja-JP')}万円` },
            { label: '不動産評価額', value: `${asset.realEstateValue.toLocaleString('ja-JP')}万円` },
            { label: '住宅ローン残高', value: `${asset.mortgageBalance.toLocaleString('ja-JP')}万円` },
            ...(asset.mortgageBalance > 0
              ? [{ label: '団信', value: asset.hasMortgageLifeInsurance ? '加入している' : '加入していない' }]
              : []),
            { label: 'その他借入残高', value: `${asset.otherLoanBalance.toLocaleString('ja-JP')}万円` },
          ]}
          onEdit={() => onEditStep(1)}
        />

        <ProfileGroup
          eyebrow="Insurance"
          title="既存の保険"
          headline={{ label: '死亡保障額', value: existingInsurance.deathCoverage.toLocaleString('ja-JP'), unit: '万円' }}
          rows={[
            { label: '月額保険料', value: `${existingInsurance.monthlyPremiumTotal.toLocaleString('ja-JP')}万円/月` },
            { label: '加入中の保障', value: coverages.length ? coverages.join(' / ') : 'なし' },
          ]}
          onEdit={() => onEditStep(2)}
        />

        <ProfileGroup
          eyebrow="Health"
          title="健康状態"
          rows={[{ label: '既往歴', value: health.hasMedicalHistory ? 'あり' : 'なし' }]}
          onEdit={() => onEditStep(3)}
        />

        <ProfileGroup
          eyebrow="Retirement"
          title="老後の希望"
          headline={{ label: '希望退職年齢', value: retirement.desiredRetirementAge, unit: '歳' }}
          rows={[
            { label: '退職金見込み額', value: `${retirement.expectedSeverancePay.toLocaleString('ja-JP')}万円` },
            {
              label: '老後の希望生活費',
              value:
                retirement.desiredMonthlyLivingCost === undefined
                  ? '自動概算'
                  : `${retirement.desiredMonthlyLivingCost.toLocaleString('ja-JP')}万円/月`,
            },
          ]}
          onEdit={() => onEditStep(4)}
        />
      </div>

      <p className="text-xs leading-relaxed text-ink-faint mt-6">
        入力内容はこの端末のブラウザにのみ保存されます。診断結果は、ここに表示されている値と公的制度の前提条件から算出されます。
      </p>
    </div>
  );
}
