import { Link } from 'react-router-dom';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';
import { GmailBulkImport } from '../components/GmailBulkImport';
import { GmailImport } from '../components/GmailImport';
import { resolveDisplayName } from '../displayName';
import { scoreColorClass } from '../scoreColor';
import { useMatchingPools } from '../useMatchingPools';

export function DashboardPage() {
  const { projectList, engineerPool, useReal } = useMatchingPools();
  const latestProject = projectList[0];
  const topCandidate = latestProject ? matchProjectToEngineers(latestProject, engineerPool)[0] : undefined;
  const topEngineer = topCandidate ? engineerPool.find((e) => e.id === topCandidate.engineerId) : undefined;

  return (
    <>
      <h1>SES Matching</h1>
      <p className="empty-note">
        {useReal
          ? '実Gmail取り込み結果に基づく案件と要員のマッチング状況です。'
          : '案件と要員のマッチング状況の概要です(現在はダミーデータ)。'}
      </p>

      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-value">{projectList.length}</div>
          <div className="stat-label">案件数</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{engineerPool.length}</div>
          <div className="stat-label">要員数</div>
        </div>
      </div>

      <h2>最新マッチング</h2>
      {latestProject && topCandidate ? (
        <Link
          to={`/matching/${latestProject.id}`}
          className="card"
          style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
        >
          <div className="card-title">{resolveDisplayName('project', latestProject.id, latestProject.projectName, useReal)}</div>
          <div className="card-row">
            <span>1位候補</span>
            <span>
              {resolveDisplayName('engineer', topCandidate.engineerId, topEngineer?.engineerName, useReal)} —{' '}
              <span className={`ranking-score ${scoreColorClass(topCandidate.score)}`}>{topCandidate.score}</span>
            </span>
          </div>
        </Link>
      ) : (
        <p className="empty-note">案件がありません。</p>
      )}

      <h2>Gmail Import (1件)</h2>
      <GmailImport />

      <h2>Gmail Import (一括)</h2>
      <GmailBulkImport />
    </>
  );
}
