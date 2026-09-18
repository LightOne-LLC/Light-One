import type { ReactNode } from 'react';

// アプリ全体で繰り返し使われてきた「白背景・角丸2xl・薄いborder・軽いshadow」のカードを共通化する。
export function Card({ children, className = '', as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  return <As className={`bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(22,35,63,0.04)] p-6 sm:p-8 ${className}`}>{children}</As>;
}
