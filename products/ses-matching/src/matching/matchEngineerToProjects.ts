import { calcTotalScore } from '../scoring/totalScore';
import { toEngineerInput } from '../intake/engineer';
import { toProjectInput } from '../intake/project';
import type { EngineerRecord, ProjectRecord } from '../intake/types';

export interface ProjectMatchResult {
  projectId: string;
  score: number;
}

/**
 * matchProjectToEngineers()の逆方向。1要員に対して複数案件をScoring Engineで
 * スコアリングし、スコア降順で返す。既存のmatchProjectToEngineers()と全く
 * 同じcalcTotalScore()をそのまま呼ぶだけで、スコアの意味・計算方法は一切
 * 変更しない(同じproject/engineerの組に対しては、どちら向きに呼んでも
 * 同一のtotalScoreになる)。
 *
 * Quick Match(要員テキストを貼り付けた場合の「この要員に合う案件を探す」)
 * のために追加した、既存matchProjectToEngineers()と対になる新規関数。
 */
export function matchEngineerToProjects(engineer: EngineerRecord, projects: ProjectRecord[]): ProjectMatchResult[] {
  const engineerInput = toEngineerInput(engineer);

  return projects
    .map((project) => ({
      projectId: project.id,
      score: calcTotalScore(toProjectInput(project), engineerInput).totalScore,
    }))
    .sort((a, b) => b.score - a.score);
}
