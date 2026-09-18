import { Card, SectionHeader } from '../ui';

/*
  前提条件。レポートの奥付にあたる部分なので、主要パネルと同じ強さで出さない。
  影を持たない quiet variant + compact heading で、読める・でも主張しない扱いにする。
*/
export function AssumptionsPanel({ assumptions }: { assumptions: string[] }) {
  if (assumptions.length === 0) return null;
  return (
    <Card as="section" variant="quiet">
      <SectionHeader variant="compact" title="Assumptions(前提条件)" />
      <ul className="grid gap-y-1.5 sm:grid-cols-2 sm:gap-x-8">
        {assumptions.map((a, i) => (
          <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-ink-muted">
            <span className="mt-[7px] w-2 h-px bg-line-strong shrink-0" aria-hidden="true" />
            <span className="min-w-0">{a}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
