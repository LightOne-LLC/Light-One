import { calcTotalScore } from '../scoring/totalScore';
import { toEngineerInput } from '../intake/engineer';
import { toProjectInput } from '../intake/project';
import type { EngineerRecord, ProjectRecord } from '../intake/types';
import { isSameSourceCompany } from './companyExclusion';
import { isClientOnlyCommercialFlow } from './commercialFlowExclusion';

export interface ProjectMatchResult {
  projectId: string;
  score: number;
}

/**
 * matchProjectToEngineers()の逆方向。1要員に対して複数案件をScoring Engineで
 * スコアリングし、スコア降順で返す。既存のmatchProjectToEngineers()と全く
 * 同じcalcTotalScore()をそのまま呼ぶだけで、スコアの意味・計算方法は一切
 * 変更しない(同じproject/engineerの組に対しては、どちら向きに呼んでも
 * 同一のtotalScoreになる)。案件と要員が同一の送信元会社(自社内)の場合は
 * matchProjectToEngineers()と同じisSameSourceCompany()で候補から除外し、
 * 商流が「貴社」止まりの案件はisClientOnlyCommercialFlow()で候補自体から
 * 除外する(どの要員から見ても同じ案件は除外される)。
 *
 * Quick Match(要員テキストを貼り付けた場合の「この要員に合う案件を探す」)
 * のために追加した、既存matchProjectToEngineers()と対になる新規関数。
 */
export function matchEngineerToProjects(engineer: EngineerRecord, projects: ProjectRecord[]): ProjectMatchResult[] {
  const engineerInput = toEngineerInput(engineer);

  return projects
    .filter((project) => !isClientOnlyCommercialFlow(project.commercialFlow))
    .filter((project) => !isSameSourceCompany(project.sourceCompany, engineer.companyName))
    .map((project) => ({
      projectId: project.id,
      score: calcTotalScore(toProjectInput(project), engineerInput).totalScore,
    }))
    .sort((a, b) => b.score - a.score);
}
