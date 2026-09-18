import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { RiskCategoryResult } from '../../types/diagnosis';
import { Card } from '../ui';

export function RadarChartPanel({ categories }: { categories: RiskCategoryResult[] }) {
  const data = categories.map((c) => ({ subject: c.label, score: c.score }));

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-700 mb-2">リスクスコア分布(0〜100、高いほど対策の必要性が高い)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fill: '#334155' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar name="リスクスコア" dataKey="score" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}
