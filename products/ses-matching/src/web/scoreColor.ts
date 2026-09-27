export function scoreColorClass(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}
