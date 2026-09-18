import type { RiskLevelLabel } from '../types/diagnosis';

interface LevelStyle {
  label: string;
  badgeClass: string;
  barClass: string;
  textClass: string;
  /** 大きな数値ブロックの地として使う淡い面 */
  surfaceClass: string;
}

// 警告色ではなく「執務レポートの状態表示」。彩度を落とし、4段階の差は
// 明度と文字色で読ませる(赤・黄の点滅するダッシュボードにしない)。
const STYLES: Record<RiskLevelLabel, LevelStyle> = {
  critical: {
    label: 'Critical',
    badgeClass: 'bg-risk-critical-soft text-risk-critical ring-1 ring-inset ring-risk-critical-ring',
    barClass: 'bg-risk-critical',
    textClass: 'text-risk-critical',
    surfaceClass: 'bg-risk-critical-soft',
  },
  high: {
    label: 'High',
    badgeClass: 'bg-risk-high-soft text-risk-high ring-1 ring-inset ring-risk-high-ring',
    barClass: 'bg-risk-high',
    textClass: 'text-risk-high',
    surfaceClass: 'bg-risk-high-soft',
  },
  medium: {
    label: 'Medium',
    badgeClass: 'bg-risk-medium-soft text-risk-medium ring-1 ring-inset ring-risk-medium-ring',
    barClass: 'bg-risk-medium',
    textClass: 'text-risk-medium',
    surfaceClass: 'bg-risk-medium-soft',
  },
  low: {
    label: 'Low',
    badgeClass: 'bg-risk-low-soft text-risk-low ring-1 ring-inset ring-risk-low-ring',
    barClass: 'bg-risk-low',
    textClass: 'text-risk-low',
    surfaceClass: 'bg-risk-low-soft',
  },
};

export function riskLevelStyle(level: RiskLevelLabel): LevelStyle {
  return STYLES[level];
}

export function formatManYen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')}万円`;
}

// 大きく見せる数値は「単位」を分離して組めるようにする(数字の階層を作るため)。
export function splitManYen(n: number): { value: string; unit: string } {
  return { value: Math.round(n).toLocaleString('ja-JP'), unit: '万円' };
}
