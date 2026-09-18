import type { ReactNode } from 'react';

/*
  Cardは「箱」ではなく「情報の重要度」を表す。
  同じ角丸・同じ影・同じpaddingを全画面で繰り返すとSaaSの管理画面になるため、
  variantごとに 面の素材 / 角丸 / 余白 / 境界の強さ / 影 を別物として定義する。

  hero    … その画面の結論。navy material。1画面に1つだけ。
  feature … 結論を支える主要情報。platinum material + 厚みのある余白。
  panel   … 標準の情報面。白 + 静かな境界。
  quiet   … 補足・前提・折りたたみの中身。影を持たない。
  inset   … 面の中の面。数値ブロックなど。brushed metal。
*/
export type CardVariant = 'hero' | 'feature' | 'panel' | 'quiet' | 'inset';

const VARIANTS: Record<CardVariant, string> = {
  hero: 'relative overflow-hidden material-navy text-white rounded-hero shadow-hero p-7 sm:p-11 lg:p-12',
  feature: 'material-platinum border border-line-soft edge-highlight rounded-card shadow-raised p-6 sm:p-9',
  panel: 'bg-surface border border-line rounded-card shadow-quiet p-5 sm:p-7',
  quiet: 'bg-surface-raised/70 border border-line-soft rounded-panel p-5 sm:p-6',
  inset: 'material-brushed border border-line-soft rounded-panel p-4 sm:p-5',
};

export function Card({
  children,
  className = '',
  variant = 'panel',
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  as?: 'div' | 'section' | 'article' | 'header';
}) {
  const Tag = as;
  return <Tag className={`${VARIANTS[variant]} ${className}`}>{children}</Tag>;
}
