// 「数字 → 単位 → 説明」の順で読める、アプリ全体で統一された数値表示。
export function Metric({
  value, unit, label, size = 'lg', tone = 'default',
}: {
  value: string | number;
  unit?: string;
  label?: string;
  size?: 'lg' | 'md';
  tone?: 'default' | 'danger';
}) {
  const valueClass = size === 'lg' ? 'text-5xl sm:text-6xl' : 'text-2xl';
  const colorClass = tone === 'danger' ? 'text-rose-600' : 'text-navy';
  return (
    <div>
      {label && <p className="text-xs text-ink-muted mb-1">{label}</p>}
      <p className={`font-bold tracking-tight tabular-nums ${valueClass} ${colorClass}`}>
        {value}
        {unit && <span className={size === 'lg' ? 'text-xl sm:text-2xl font-medium text-ink-muted ml-1' : 'text-sm font-medium text-ink-muted ml-1'}>{unit}</span>}
      </p>
    </div>
  );
}
