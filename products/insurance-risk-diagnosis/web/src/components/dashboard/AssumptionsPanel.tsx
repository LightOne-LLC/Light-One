import { findEvidenceForAssumption } from '../../rag';
import { Card, SectionHeader } from '../ui';

/*
  前提条件。レポートの奥付にあたる部分なので、主要パネルと同じ強さで出さない。
  影を持たない quiet variant + compact heading で、読める・でも主張しない扱いにする。
  各行について、findEvidenceForAssumption()でdirect matchする出典があれば
  組織名だけの小さなindicatorを添える(根拠が無い前提文には何も付けない — 捏造しない)。
*/
export function AssumptionsPanel({ assumptions }: { assumptions: string[] }) {
  if (assumptions.length === 0) return null;
  return (
    <Card as="section" variant="quiet" className="animate-fade-in">
      <SectionHeader variant="compact" title="Assumptions(前提条件)" />
      <ul className="grid gap-y-1.5 sm:grid-cols-2 sm:gap-x-8">
        {assumptions.map((a, i) => {
          const sources = findEvidenceForAssumption(a);
          return (
            <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-ink-muted">
              <span className="mt-[7px] w-2 h-px bg-line-strong shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                {a}
                {sources.map((s) => (
                  <span key={s.sourceId} className="ml-2 text-[11px] text-ink-faint whitespace-nowrap">
                    ({s.organization})
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
