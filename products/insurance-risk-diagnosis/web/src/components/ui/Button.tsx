import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'md' | 'sm';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-dark disabled:opacity-40',
  dark: 'bg-navy-dark text-white hover:bg-navy disabled:opacity-40',
  secondary: 'border border-line text-ink-muted hover:bg-canvas disabled:opacity-40',
  ghost: 'text-ink-muted hover:text-navy disabled:opacity-40',
  danger: 'border border-rose-200/80 text-rose-700 hover:bg-rose-50/60 disabled:opacity-40',
};

const SIZE_CLASS: Record<Size, string> = {
  md: 'min-h-[44px] px-5 py-2.5 text-sm',
  sm: 'min-h-[40px] px-4 py-2 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// アプリ全体でバラバラだったボタンの高さ・色・focus stateを統一する。
export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-1 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    />
  );
}
