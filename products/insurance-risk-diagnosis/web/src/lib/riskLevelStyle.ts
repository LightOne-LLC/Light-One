import type { RiskLevelLabel } from '../types/diagnosis';

interface LevelStyle {
  label: string;
  badgeClass: string;
  barClass: string;
  textClass: string;
}

const STYLES: Record<RiskLevelLabel, LevelStyle> = {
  critical: { label: 'Critical', badgeClass: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200', barClass: 'bg-rose-500', textClass: 'text-rose-700' },
  high: { label: 'High', badgeClass: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200', barClass: 'bg-amber-500', textClass: 'text-amber-700' },
  medium: { label: 'Medium', badgeClass: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200', barClass: 'bg-indigo-500', textClass: 'text-indigo-700' },
  low: { label: 'Low', badgeClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200', barClass: 'bg-emerald-500', textClass: 'text-emerald-700' },
};

export function riskLevelStyle(level: RiskLevelLabel): LevelStyle {
  return STYLES[level];
}

export function formatManYen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')}万円`;
}
