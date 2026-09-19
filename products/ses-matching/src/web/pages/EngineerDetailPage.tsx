import { Link, useParams } from 'react-router-dom';
import { toEngineerInput } from '../../intake/engineer';
import { toProjectInput } from '../../intake/project';
import { calcTotalScore } from '../../scoring/totalScore';
import { resolveDisplayName } from '../displayName';
import { formatDateValue } from '../formatDateValue';
import { scoreColorClass } from '../scoreColor';
import { useMatchingPools } from '../useMatchingPools';

/**
 * 候補者詳細。既存のcalcTotalScore()をそのまま呼び出してスコア内訳を得る
 * だけで、スコア計算ロジックはここで一切再実装しない
 * (matchProjectToEngineers()が返すtotalScoreと必ず一致する)。
 */
export function EngineerDetailPage() {
  const { projectId, engineerId } = useParams();
  const { projectList, engineerPool, useReal } = useMatchingPools();

  const project = projectList.find((p) => p.id === projectId);
  const engineer = engineerPool.find((e) => e.id === engineerId);

  if (!project || !engineer) {
    return (
      <>
        <h1>Engineer Detail</h1>
        <p className="empty-note">案件または候補者が見つかりません。</p>
        <Link to={projectId ? `/matching/${projectId}` : '/matching'}>← ランキングに戻る</Link>
      </>
    );
  }

  const { totalScore, breakdown } = calcTotalScore(toProjectInput(project), toEngineerInput(engineer));

  return (
    <>
      <h1>{resolveDisplayName('engineer', engineer.id, engineer.engineerName, useReal)}</h1>
      {useReal && engineer.engineerName && (
        <p className="empty-note" style={{ fontSize: '0.75rem' }}>
          ID: {engineer.id}
        </p>
      )}
      <p className="empty-note">
        案件 {resolveDisplayName('project', project.id, project.projectName, useReal)} に対する候補者詳細です。
      </p>
      <div className="card-row">
        <Link to={`/matching/${project.id}`}>← ランキングに戻る</Link>
      </div>

      <div className="card">
        <div className="card-title">総合スコア</div>
        <div className={`ranking-score ${scoreColorClass(totalScore)}`} style={{ fontSize: '1.75rem' }}>
          {totalScore}
        </div>
        <div className="card-row">
          <span>スキル</span>
          <span>{Math.round(breakdown.skillScore * 100)}</span>
        </div>
        <div className="card-row">
          <span>単価</span>
          <span>{Math.round(breakdown.rateScore * 100)}</span>
        </div>
        <div className="card-row">
          <span>勤務地</span>
          <span>{Math.round(breakdown.locationScore * 100)}</span>
        </div>
        <div className="card-row">
          <span>タイミング</span>
          <span>{Math.round(breakdown.timingScore * 100)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">候補者情報</div>
        <div>
          {engineer.skills.map((skill) => (
            <span key={skill.name} className="skill-tag">
              {skill.name} {skill.years}年
            </span>
          ))}
        </div>
        <div className="card-row">
          <span>希望単価</span>
          <span>
            {engineer.desiredRateMin}〜{engineer.desiredRateMax}万円/月
          </span>
        </div>
        <div className="card-row">
          <span>希望勤務地</span>
          <span>{engineer.desiredLocations.join(' / ')}</span>
        </div>
        <div className="card-row">
          <span>リモート希望</span>
          <span>{engineer.remoteDesired ? '希望' : '希望しない'}</span>
        </div>
        <div className="card-row">
          <span>稼働開始</span>
          <span>{formatDateValue(engineer.availableFrom)}</span>
        </div>
        <div className="card-row">
          <span>日本語レベル</span>
          <span>{engineer.japaneseLevel ?? '未記載'}</span>
        </div>
      </div>
    </>
  );
}
