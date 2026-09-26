import { normalizeWeights } from './totalScore';
import { ScoreBreakdown, ScoreWeights } from './types';

export type FeedbackDecision = '採用' | '却下';

export interface FeedbackSample {
  breakdown: Pick<ScoreBreakdown, 'skillScore' | 'rateScore' | 'locationScore' | 'timingScore'>;
  decision: FeedbackDecision;
}

const DIMENSION_KEYS = ['skillScore', 'rateScore', 'locationScore', 'timingScore'] as const;
type DimensionKey = (typeof DIMENSION_KEYS)[number];

const DIMENSION_TO_WEIGHT_KEY: Record<DimensionKey, keyof ScoreWeights> = {
  skillScore: 'skillWeight',
  rateScore: 'rateWeight',
  locationScore: 'locationWeight',
  timingScore: 'timingWeight',
};

/** 最低でもこの割合は各重みに残す（0に潰れて特定要素を完全無視しないようにする） */
const MIN_WEIGHT_RATIO = 0.05;

function average(samples: FeedbackSample[], key: DimensionKey): number {
  if (samples.length === 0) return 0;
  const sum = samples.reduce((acc, s) => acc + s.breakdown[key], 0);
  return sum / samples.length;
}

/**
 * フィードバック履歴を元に重みを微調整する簡易学習ロジック。
 *
 * 本格的な勾配降下法は使わず、以下のシンプルな加重平均的更新を行う:
 *   1. 採用(成約)されたマッチと却下されたマッチ、それぞれのスコア内訳の平均を求める。
 *   2. 各評価軸について (採用グループの平均 - 却下グループの平均) を差分とする。
 *      差分がプラスに大きいほど「その軸のスコアが高いマッチほど採用されやすい」
 *      ことを意味するため、その軸の重みを増やす。逆にマイナスならその軸は
 *      採用/却下の判断に寄与していない（もしくは逆相関）ため重みを減らす。
 *   3. newWeight = oldWeight * (1 + learningRate * diff) で更新し、
 *      最低保証割合でクリップした上で合計が1になるよう正規化する。
 *
 * 採用・却下のどちらかのサンプルが無い場合は学習できないため、現在の重みを
 * そのまま返す。
 */
export function adjustWeightsFromFeedback(
  currentWeights: ScoreWeights,
  feedbackSamples: FeedbackSample[],
  learningRate = 0.2,
): ScoreWeights {
  const accepted = feedbackSamples.filter((s) => s.decision === '採用');
  const rejected = feedbackSamples.filter((s) => s.decision === '却下');

  if (accepted.length === 0 || rejected.length === 0) {
    return currentWeights;
  }

  const rawUpdated: Record<keyof ScoreWeights, number> = { ...currentWeights };

  for (const dim of DIMENSION_KEYS) {
    const diff = average(accepted, dim) - average(rejected, dim);
    const weightKey = DIMENSION_TO_WEIGHT_KEY[dim];
    const updated = currentWeights[weightKey] * (1 + learningRate * diff);
    rawUpdated[weightKey] = Math.max(updated, 0);
  }

  const total = Object.values(rawUpdated).reduce((a, b) => a + b, 0);
  const minWeight = total > 0 ? total * MIN_WEIGHT_RATIO : 0;

  const clipped: ScoreWeights = {
    skillWeight: Math.max(rawUpdated.skillWeight, minWeight),
    rateWeight: Math.max(rawUpdated.rateWeight, minWeight),
    locationWeight: Math.max(rawUpdated.locationWeight, minWeight),
    timingWeight: Math.max(rawUpdated.timingWeight, minWeight),
  };

  return normalizeWeights(clipped);
}
