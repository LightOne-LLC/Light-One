import { dummyEngineers, dummyProjects } from '../demo/dummyData';
import type { EngineerRecord, ProjectRecord } from '../intake/types';
import { useWorkspace } from './workspaceContext';

/**
 * MatchingPage/EngineerDetailPage/DashboardPageが参照する「案件一覧」
 * 「要員プール」を一箇所に集約する。実Gmail取り込みが成功していれば
 * (dataReady)そちらを、まだ成功していなければ既存のdummy dataを使う
 * (既存dummy matchingのregressionを維持するため)。
 *
 * 重要: 取得に成功した後は、たとえ0件であってもdummy dataへは戻さない
 * (dataReadyがsingle source of truth — 件数ではなく「成功したか」で判断する)。
 */
export function useMatchingPools(): {
  projectList: ProjectRecord[];
  engineerPool: EngineerRecord[];
  useReal: boolean;
} {
  const { result, dataReady } = useWorkspace();
  const realProjects = dataReady && result?.success ? (result.validProjects ?? []) : [];
  const realEngineers = dataReady && result?.success ? (result.validEngineers ?? []) : [];

  return {
    projectList: dataReady ? realProjects : dummyProjects,
    engineerPool: dataReady ? realEngineers : dummyEngineers,
    useReal: dataReady,
  };
}
