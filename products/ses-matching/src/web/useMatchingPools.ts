import { dummyEngineers, dummyProjects } from '../demo/dummyData';
import type { EngineerRecord, ProjectRecord } from '../intake/types';
import { useWorkspace } from './workspaceContext';

/**
 * MatchingPage/EngineerDetailPageが参照する「案件一覧」「要員プール」を
 * 一箇所に集約する。実Gmail取り込み(検証済みのvalidProjects/validEngineers)
 * が存在すればそちらを、無ければ既存のdummy dataを使う
 * (既存dummy matchingのregressionを維持するため)。
 */
export function useMatchingPools(): {
  projectList: ProjectRecord[];
  engineerPool: EngineerRecord[];
  useReal: boolean;
} {
  const { result } = useWorkspace();
  const realProjects = result?.success ? (result.validProjects ?? []) : [];
  const realEngineers = result?.success ? (result.validEngineers ?? []) : [];
  const useReal = realProjects.length > 0;

  return {
    projectList: useReal ? realProjects : dummyProjects,
    engineerPool: useReal ? realEngineers : dummyEngineers,
    useReal,
  };
}
