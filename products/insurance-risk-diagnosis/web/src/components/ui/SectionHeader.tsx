import type { ReactNode } from 'react';

/*
  見出しの役割を分化させる。
  全パネルが同じ「text-lg semibold + 説明文」だと、情報の重要度の差が
  タイポグラフィに一切現れず、結果として均質なダッシュボードに見える。

  editorial … 章の顔。eyebrow + 大きな見出し + 罫線。主要パネルにのみ使う。
  panel     … 標準。見出し + 補足。
  compact   … 面の中の小見出し。ラベルとして振る舞う。
*/
export type HeaderVariant = 'editorial' | 'panel' | 'compact';

export function Eyebrow({ children, tone = 'muted', className = '' }: { children: ReactNode; tone?: 'muted' | 'light' | 'accent'; className?: string }) {
  const toneClass = tone === 'light' ? 'text-white/55' : tone === 'accent' ? 'text-platinum' : 'text-ink-faint';
  return <p className={`eyebrow ${toneClass} ${className}`}>{children}</p>;
}

export function SectionHeader({
  title,
  description,
  eyebrow,
  variant = 'panel',
  aside,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  variant?: HeaderVariant;
  aside?: ReactNode;
}) {
  if (variant === 'compact') {
    return (
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">{title}</h3>
        {aside}
      </div>
    );
  }

  if (variant === 'editorial') {
    return (
      <header className="mb-6 sm:mb-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
            <h2 className="text-[21px] sm:text-2xl font-semibold tracking-[-0.02em] text-ink leading-tight">{title}</h2>
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        <hr className="rule-fade mt-4 mb-3" />
        {description && <p className="text-[13px] leading-relaxed text-ink-muted max-w-2xl">{description}</p>}
      </header>
    );
  }

  return (
    <header className="mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
          <h2 className="text-base sm:text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {description && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{description}</p>}
    </header>
  );
}
