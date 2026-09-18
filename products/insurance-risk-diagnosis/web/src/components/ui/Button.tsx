import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'md' | 'sm';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40',
  dark: 'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40',
  secondary: 'border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40',
  ghost: 'text-slate-500 hover:text-slate-800 disabled:opacity-40',
  danger: 'border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40',
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
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-1 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    />
  );
}
