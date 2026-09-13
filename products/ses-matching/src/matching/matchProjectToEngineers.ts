import { calcTotalScore } from '../scoring/totalScore';
import { toEngineerInput } from '../intake/engineer';
import { toProjectInput } from '../intake/project';
import type { EngineerRecord, ProjectRecord } from '../intake/types';

export interface MatchResult {
  engineerId: string;
  score: number;
}

/**
 * 1案件に対して複数要員をScoring Engineでスコアリングし、スコア降順で返す。
 *
 * project/engineersは呼び出し側で validateProjectRecord / validateEngineerRecord
 * を通過済みであることを前提とする（このレイヤーではvalidationを行わない）。
 *
 * スコア計算自体はcalcTotalScore()にそのまま委譲し、ここでは複数要員の処理・
 * engineerIdの付与・並べ替えのみを行う。同点の場合はArray.prototype.sortの
 * 安定ソートにより、元のengineers配列内の順序を維持する。
 */
export function matchProjectToEngineers(project: ProjectRecord, engineers: EngineerRecord[]): MatchResult[] {
  const projectInput = toProjectInput(project);

  return engineers
    .map((engineer) => ({
      engineerId: engineer.id,
      score: calcTotalScore(projectInput, toEngineerInput(engineer)).totalScore,
    }))
    .sort((a, b) => b.score - a.score);
}
