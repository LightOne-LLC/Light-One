export function AssumptionsPanel({ assumptions }: { assumptions: string[] }) {
  if (assumptions.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-canvas p-6 sm:p-8">
      <h2 className="text-sm font-semibold tracking-tight text-navy mb-3">Assumptions(前提条件)</h2>
      <ul className="space-y-1.5 text-xs text-ink-muted">
        {assumptions.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-line shrink-0">・</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
