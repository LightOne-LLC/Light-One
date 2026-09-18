export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold tracking-tight text-navy mb-1">{title}</h2>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
