import { adjustWeightsFromFeedback, FeedbackSample } from '../weightLearning';
import { DEFAULT_WEIGHTS } from '../types';

describe('adjustWeightsFromFeedback', () => {
  it('採用サンプルまたは却下サンプルが無い場合は重みを変更しない', () => {
    const onlyAccepted: FeedbackSample[] = [
      { decision: '採用', breakdown: { skillScore: 0.9, rateScore: 0.9, locationScore: 0.9, timingScore: 0.9 } },
    ];
    expect(adjustWeightsFromFeedback(DEFAULT_WEIGHTS, onlyAccepted)).toEqual(DEFAULT_WEIGHTS);
    expect(adjustWeightsFromFeedback(DEFAULT_WEIGHTS, [])).toEqual(DEFAULT_WEIGHTS);
  });

  it('採用マッチでスキルスコアが高く、却下マッチで低い傾向があればスキル重みが増える', () => {
    const samples: FeedbackSample[] = [
      { decision: '採用', breakdown: { skillScore: 0.95, rateScore: 0.5, locationScore: 0.5, timingScore: 0.5 } },
      { decision: '採用', breakdown: { skillScore: 0.9, rateScore: 0.5, locationScore: 0.5, timingScore: 0.5 } },
      { decision: '却下', breakdown: { skillScore: 0.2, rateScore: 0.5, locationScore: 0.5, timingScore: 0.5 } },
      { decision: '却下', breakdown: { skillScore: 0.3, rateScore: 0.5, locationScore: 0.5, timingScore: 0.5 } },
    ];
    const updated = adjustWeightsFromFeedback(DEFAULT_WEIGHTS, samples);
    expect(updated.skillWeight).toBeGreaterThan(DEFAULT_WEIGHTS.skillWeight);
  });

  it('却下マッチの方が単価スコアが高い(単価は決め手にならない)場合は単価重みが下がる', () => {
    const samples: FeedbackSample[] = [
      { decision: '採用', breakdown: { skillScore: 0.9, rateScore: 0.3, locationScore: 0.5, timingScore: 0.5 } },
      { decision: '却下', breakdown: { skillScore: 0.2, rateScore: 0.9, locationScore: 0.5, timingScore: 0.5 } },
    ];
    const updated = adjustWeightsFromFeedback(DEFAULT_WEIGHTS, samples);
    expect(updated.rateWeight).toBeLessThan(DEFAULT_WEIGHTS.rateWeight);
  });

  it('更新後も重みの合計は1になる', () => {
    const samples: FeedbackSample[] = [
      { decision: '採用', breakdown: { skillScore: 0.95, rateScore: 0.9, locationScore: 0.9, timingScore: 0.9 } },
      { decision: '却下', breakdown: { skillScore: 0.1, rateScore: 0.1, locationScore: 0.1, timingScore: 0.1 } },
    ];
    const updated = adjustWeightsFromFeedback(DEFAULT_WEIGHTS, samples);
    const sum = updated.skillWeight + updated.rateWeight + updated.locationWeight + updated.timingWeight;
    expect(sum).toBeCloseTo(1);
  });

  it('いずれの重みも最低割合を下回らない', () => {
    const samples: FeedbackSample[] = [
      { decision: '採用', breakdown: { skillScore: 1, rateScore: 0, locationScore: 0, timingScore: 0 } },
      { decision: '却下', breakdown: { skillScore: 0, rateScore: 1, locationScore: 1, timingScore: 1 } },
    ];
    const updated = adjustWeightsFromFeedback(DEFAULT_WEIGHTS, samples, 1);
    expect(updated.rateWeight).toBeGreaterThan(0);
    expect(updated.locationWeight).toBeGreaterThan(0);
    expect(updated.timingWeight).toBeGreaterThan(0);
  });
});
