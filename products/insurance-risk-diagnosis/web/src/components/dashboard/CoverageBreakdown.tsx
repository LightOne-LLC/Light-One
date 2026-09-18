import type { DeathCoverageResult } from '../../types/diagnosis';
import { Card } from '../ui';

function fmt(n: number) {
  return `${n.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}万円`;
}

export function CoverageBreakdown({ deathCoverage }: { deathCoverage: DeathCoverageResult }) {
  const b = deathCoverage.breakdown;
  return (
    <Card>
      <h3 className="text-sm font-semibold text-navy mb-1">死亡リスクの内訳詳細</h3>
      <p className="text-3xl font-bold tracking-tight text-navy mb-4">{fmt(deathCoverage.requiredAmount)}</p>

      <table className="w-full text-sm table-fixed">
        <tbody>
          <Row label="遺族生活費(末子独立まで)" value={b.phaseALivingCost} />
          <Row label="遺族生活費(末子独立後・配偶者)" value={b.phaseBLivingCost} />
          <Row label="教育費残り総額" value={b.educationTotal} />
          <Row label="葬儀費用等一時費用" value={b.funeralCost} />
          {b.mortgageAddOn > 0 && <Row label="住宅ローン残高(団信未加入)" value={b.mortgageAddOn} />}
          <Row label="遺族年金等 公的保障(控除)" value={-b.survivorPensionTotal} />
          <Row label="貯蓄額(控除)" value={-b.savings} />
          <Row label="保有資産(控除)" value={-b.otherAssets} />
          <Row label="既存の死亡保険金(控除)" value={-b.existingDeathCoverage} />
        </tbody>
      </table>

      <details className="mt-4">
        <summary className="text-sm text-navy cursor-pointer">計算根拠の詳細を見る</summary>
        <ul className="mt-2 space-y-1 text-xs text-ink-muted list-disc list-inside">
          {deathCoverage.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-b border-line">
      <td className="py-1 text-ink-muted">{label}</td>
      <td className={`py-1 text-right font-medium ${value < 0 ? 'text-emerald-600' : 'text-navy'}`}>
        {value < 0 ? '−' : ''}
        {fmt(Math.abs(value))}
      </td>
    </tr>
  );
}
