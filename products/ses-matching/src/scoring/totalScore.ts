import { calcLocationScore } from './locationScore';
import { calcRateScore } from './rateScore';
import { calcSkillScore } from './skillScore';
import { calcTimingScore } from './timingScore';
import { DEFAULT_WEIGHTS, EngineerInput, ProjectInput, ScoreWeights, TotalScoreResult } from './types';

/** 重みの合計が1.0になるよう正規化する（0除算防止のためすべて0の場合は均等割り） */
export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum = weights.skillWeight + weights.rateWeight + weights.locationWeight + weights.timingWeight;
  if (sum <= 0) {
    return { skillWeight: 0.25, rateWeight: 0.25, locationWeight: 0.25, timingWeight: 0.25 };
  }
  return {
    skillWeight: weights.skillWeight / sum,
    rateWeight: weights.rateWeight / sum,
    locationWeight: weights.locationWeight / sum,
    timingWeight: weights.timingWeight / sum,
  };
}

/**
 * 案件と要員の各種スコアを算出し、重み付き合計として0〜100の総合スコアを返す。
 */
export function calcTotalScore(
  project: ProjectInput,
  engineer: EngineerInput,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): TotalScoreResult {
  const normalizedWeights = normalizeWeights(weights);

  const skillScore = calcSkillScore(project.requiredSkills, engineer.skills);
  const rateScore = calcRateScore(project.rateMin, project.rateMax, engineer.desiredRateMin, engineer.desiredRateMax);
  const locationScore = calcLocationScore(
    project.location,
    project.remoteAllowed,
    engineer.desiredLocations,
    engineer.remoteDesired,
  );
  const timingScore = calcTimingScore(project.startDate, engineer.availableFrom);

  const weightedSum =
    skillScore * normalizedWeights.skillWeight +
    rateScore * normalizedWeights.rateWeight +
    locationScore * normalizedWeights.locationWeight +
    timingScore * normalizedWeights.timingWeight;

  return {
    totalScore: Math.round(weightedSum * 100 * 10) / 10, // 小数第1位までに丸める
    breakdown: {
      skillScore,
      rateScore,
      locationScore,
      timingScore,
      weightsUsed: normalizedWeights,
    },
  };
}
