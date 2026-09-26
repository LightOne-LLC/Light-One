import { calcTimingScore } from '../timingScore';

describe('calcTimingScore', () => {
  it('稼働可能日が開始日と同日なら満点', () => {
    expect(calcTimingScore('2026-01-01', '2026-01-01')).toBe(1);
  });

  it('稼働可能日が開始日より前なら満点', () => {
    expect(calcTimingScore('2026-01-15', '2026-01-01')).toBe(1);
  });

  it('7日以内の遅れは0.9', () => {
    expect(calcTimingScore('2026-01-01', '2026-01-05')).toBe(0.9);
  });

  it('30日を超える遅れはスコアが大きく下がる', () => {
    expect(calcTimingScore('2026-01-01', '2026-03-01')).toBeLessThanOrEqual(0.25);
  });

  it('60日を超える遅れは0点', () => {
    expect(calcTimingScore('2026-01-01', '2026-12-01')).toBe(0);
  });

  it('不正な日付文字列はエラーを投げる', () => {
    expect(() => calcTimingScore('not-a-date', '2026-01-01')).toThrow();
  });
});
