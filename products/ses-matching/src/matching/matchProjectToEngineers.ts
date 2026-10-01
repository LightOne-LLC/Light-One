import { calcTotalScore } from '../scoring/totalScore';
import { toEngineerInput } from '../intake/engineer';
import { toProjectInput } from '../intake/project';
import type { EngineerRecord, ProjectRecord } from '../intake/types';
import { isSameSourceCompany } from './companyExclusion';
import { isClientOnlyCommercialFlow } from './commercialFlowExclusion';

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
 * 案件の商流が「貴社」止まり(isClientOnlyCommercialFlow参照)の場合、
 * その案件自体を要員とのマッチング対象から除外する(どの要員に対しても
 * 空のランキングを返す)。案件と要員が同一の送信元会社(自社内)の場合は、
 * その組み合わせだけを候補から除外する(isSameSourceCompany参照)。
 * スコア計算自体はcalcTotalScore()にそのまま委譲し、ここでは複数要員の
 * 処理・engineerIdの付与・並べ替えのみを行う。同点の場合は
 * Array.prototype.sortの安定ソートにより、元のengineers配列内の順序を
 * 維持する。
 */
export function matchProjectToEngineers(project: ProjectRecord, engineers: EngineerRecord[]): MatchResult[] {
  if (isClientOnlyCommercialFlow(project.commercialFlow)) return [];

  const projectInput = toProjectInput(project);

  return engineers
    .filter((engineer) => !isSameSourceCompany(project.sourceCompany, engineer.companyName))
    .map((engineer) => ({
      engineerId: engineer.id,
      score: calcTotalScore(projectInput, toEngineerInput(engineer)).totalScore,
    }))
    .sort((a, b) => b.score - a.score);
}
