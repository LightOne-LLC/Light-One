import { calcRateScore } from '../rateScore';

describe('calcRateScore', () => {
  it('要員希望レンジが案件レンジに完全に含まれる場合は1.0', () => {
    expect(calcRateScore(50, 80, 60, 70)).toBe(1);
  });

  it('レンジが完全一致する場合は1.0', () => {
    expect(calcRateScore(60, 70, 60, 70)).toBe(1);
  });

  it('部分的に重なる場合は重なり割合に応じたスコアになる', () => {
    // 案件: 50-65, 要員希望: 60-80 => 重なりは60-65(5), 要員希望レンジは20
    const score = calcRateScore(50, 65, 60, 80);
    expect(score).toBeCloseTo(5 / 20);
  });

  it('要員希望が単一値で案件レンジ内なら満点', () => {
    expect(calcRateScore(50, 80, 65, 65)).toBe(1);
  });

  it('レンジが全く重ならない場合は低いスコアになる', () => {
    const score = calcRateScore(80, 90, 40, 50);
    expect(score).toBeLessThan(0.4);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('ギャップが大きいほどスコアが下がる', () => {
    const nearMiss = calcRateScore(80, 90, 70, 79);
    const farMiss = calcRateScore(80, 90, 10, 20);
    expect(nearMiss).toBeGreaterThan(farMiss);
  });

  it('不正なレンジはエラーを投げる', () => {
    expect(() => calcRateScore(80, 70, 10, 20)).toThrow();
  });
});
