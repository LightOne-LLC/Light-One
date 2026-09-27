import { calcTotalScore, normalizeWeights } from '../totalScore';
import { EngineerInput, ProjectInput } from '../types';

const project: ProjectInput = {
  requiredSkills: [{ name: 'Java', minYears: 3, required: true }],
  rateMin: 60,
  rateMax: 80,
  location: '東京都',
  remoteAllowed: true,
  startDate: '2026-04-01',
  japaneseLevel: 'business',
};

const perfectEngineer: EngineerInput = {
  skills: [{ name: 'Java', years: 5 }],
  desiredRateMin: 65,
  desiredRateMax: 75,
  desiredLocations: ['東京都'],
  remoteDesired: true,
  availableFrom: '2026-04-01',
  japaneseLevel: 'business',
};

describe('normalizeWeights', () => {
  it('合計が1になるよう正規化する', () => {
    const normalized = normalizeWeights({
      skillWeight: 2,
      rateWeight: 1,
      locationWeight: 1,
      timingWeight: 0,
    });
    const sum =
      normalized.skillWeight + normalized.rateWeight + normalized.locationWeight + normalized.timingWeight;
    expect(sum).toBeCloseTo(1);
  });

  it('全て0の場合は均等割りにする', () => {
    const normalized = normalizeWeights({
      skillWeight: 0,
      rateWeight: 0,
      locationWeight: 0,
      timingWeight: 0,
    });
    expect(normalized.skillWeight).toBeCloseTo(0.25);
  });
});

describe('calcTotalScore', () => {
  it('全項目が完全一致する場合は100点満点に近いスコアになる', () => {
    const result = calcTotalScore(project, perfectEngineer);
    expect(result.totalScore).toBe(100);
    expect(result.breakdown.skillScore).toBe(1);
    expect(result.breakdown.rateScore).toBe(1);
    expect(result.breakdown.locationScore).toBe(1);
    expect(result.breakdown.timingScore).toBe(1);
  });

  it('重みを変えると総合スコアも変化する', () => {
    const badRateEngineer: EngineerInput = {
      ...perfectEngineer,
      desiredRateMin: 200,
      desiredRateMax: 250,
    };
    const highRateWeightScore = calcTotalScore(project, badRateEngineer, {
      skillWeight: 0.1,
      rateWeight: 0.7,
      locationWeight: 0.1,
      timingWeight: 0.1,
    });
    const lowRateWeightScore = calcTotalScore(project, badRateEngineer, {
      skillWeight: 0.7,
      rateWeight: 0.1,
      locationWeight: 0.1,
      timingWeight: 0.1,
    });
    expect(lowRateWeightScore.totalScore).toBeGreaterThan(highRateWeightScore.totalScore);
  });

  it('重みは正規化されて使用される（weightsUsedの合計が1）', () => {
    const result = calcTotalScore(project, perfectEngineer, {
      skillWeight: 2,
      rateWeight: 2,
      locationWeight: 2,
      timingWeight: 2,
    });
    const usedSum = Object.values(result.breakdown.weightsUsed).reduce((a, b) => a + b, 0);
    expect(usedSum).toBeCloseTo(1);
  });
});
