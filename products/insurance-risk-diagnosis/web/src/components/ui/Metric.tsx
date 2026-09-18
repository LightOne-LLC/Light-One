/*
  数字を金融商品の主要情報として扱うための型組み。
  スコア・不足額・保障額は「文章の中の数字」ではなく、
  ラベル → 数値 → 単位 の明確な階層を持つ独立したブロックとして見せる。
*/
type MetricSize = 'display' | 'xl' | 'lg' | 'md' | 'sm';
type MetricTone = 'default' | 'danger' | 'light' | 'muted';

const SIZES: Record<MetricSize, { value: string; unit: string; label: string }> = {
  display: { value: 'text-[64px] sm:text-[84px] leading-[0.86]', unit: 'text-2xl sm:text-3xl', label: 'mb-3' },
  xl: { value: 'text-4xl sm:text-5xl leading-none', unit: 'text-base sm:text-lg', label: 'mb-2' },
  lg: { value: 'text-3xl leading-none', unit: 'text-sm', label: 'mb-1.5' },
  md: { value: 'text-2xl leading-none', unit: 'text-xs', label: 'mb-1' },
  sm: { value: 'text-lg leading-none', unit: 'text-[11px]', label: 'mb-0.5' },
};

const TONES: Record<MetricTone, { value: string; unit: string; label: string }> = {
  default: { value: 'text-ink', unit: 'text-ink-faint', label: 'text-ink-faint' },
  danger: { value: 'text-risk-critical', unit: 'text-risk-critical/60', label: 'text-ink-faint' },
  light: { value: 'text-white', unit: 'text-white/40', label: 'text-white/55' },
  muted: { value: 'text-ink-muted', unit: 'text-ink-faint', label: 'text-ink-faint' },
};

export function Metric({
  value,
  unit,
  label,
  size = 'lg',
  tone = 'default',
  className = '',
}: {
  value: string | number;
  unit?: string;
  label?: string;
  size?: MetricSize;
  tone?: MetricTone;
  className?: string;
}) {
  const s = SIZES[size];
  const t = TONES[tone];
  return (
    <div className={className}>
      {label && <p className={`eyebrow ${t.label} ${s.label}`}>{label}</p>}
      <p className={`font-display-num font-bold ${s.value} ${t.value}`}>
        {value}
        {unit && <span className={`ml-1.5 font-medium ${s.unit} ${t.unit}`}>{unit}</span>}
      </p>
    </div>
  );
}
