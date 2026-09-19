import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { RiskCategoryResult } from '../../types/diagnosis';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { Card, SectionHeader } from '../ui';

// チャートもブランドの配色に従わせる。既定のindigo/紫系は使わない。
const NAVY = '#101a30';
const LINE = '#dde1e8';
const INK_MUTED = '#5c6577';

export function RadarChartPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const data = categories.map((c) => ({ subject: c.label, score: c.score }));
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Card variant="panel" className="animate-rise">
      <SectionHeader
        variant="compact"
        title="リスクスコア分布"
        aside={<span className="text-[11px] text-ink-faint">0〜100 / 高いほど対策の必要性が高い</span>}
      />
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={LINE} />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: INK_MUTED }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#8b93a3' }} axisLine={false} />
          <Radar
            name="リスクスコア"
            dataKey="score"
            stroke={NAVY}
            fill={NAVY}
            fillOpacity={0.14}
            strokeWidth={1.5}
            isAnimationActive={!reducedMotion}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}
