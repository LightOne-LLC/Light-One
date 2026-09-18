import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'lg' | 'md' | 'sm';

/*
  ボタンも「面」として扱う。primaryは単色ではなくmaterial-navyの面に
  縁のhighlightと深い影を持たせ、押せる厚みのあるオブジェクトとして見せる。
*/
const VARIANTS: Record<Variant, string> = {
  primary: 'material-navy text-white edge-highlight-dark shadow-raised hover:brightness-110 active:brightness-95',
  dark: 'bg-navy-dark text-white hover:bg-navy shadow-quiet',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-navy/40 hover:bg-surface-raised shadow-quiet',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-raised',
  danger: 'bg-surface text-risk-critical border border-risk-critical-ring hover:bg-risk-critical-soft',
};

const SIZES: Record<Size, string> = {
  lg: 'min-h-[52px] px-7 text-[15px]',
  md: 'min-h-[44px] px-5 text-sm',
  sm: 'min-h-[38px] px-4 text-[13px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
