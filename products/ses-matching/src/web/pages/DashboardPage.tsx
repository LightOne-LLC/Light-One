import { Link } from 'react-router-dom';
import { dummyEngineers, dummyProjects } from '../../demo/dummyData';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';
import { scoreColorClass } from '../scoreColor';

export function DashboardPage() {
  const latestProject = dummyProjects[0];
  const topCandidate = latestProject
    ? matchProjectToEngineers(latestProject, dummyEngineers)[0]
    : undefined;

  return (
    <>
      <h1>SES Matching</h1>
      <p className="empty-note">案件と要員のマッチング状況の概要です(現在はダミーデータ)。</p>

      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-value">{dummyProjects.length}</div>
          <div className="stat-label">案件数</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{dummyEngineers.length}</div>
          <div className="stat-label">要員数</div>
        </div>
      </div>

      <h2>最新マッチング</h2>
      {latestProject && topCandidate ? (
        <Link to={`/matching/${latestProject.id}`} className="card" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <div className="card-title">{latestProject.id}</div>
          <div className="card-row">
            <span>1位候補</span>
            <span>
              {topCandidate.engineerId} —{' '}
              <span className={`ranking-score ${scoreColorClass(topCandidate.score)}`}>{topCandidate.score}</span>
            </span>
          </div>
        </Link>
      ) : (
        <p className="empty-note">案件がありません。</p>
      )}
    </>
  );
}
