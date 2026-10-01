import { Link, useParams } from 'react-router-dom';
import { isSameSourceCompany } from '../../matching/companyExclusion';
import { isClientOnlyCommercialFlow } from '../../matching/commercialFlowExclusion';
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
 *
 * マッチングランキング(MatchingPage)の候補クリックから到達するページ
 * だが、現在見ている案件の情報(案件名/案件出し会社/商流/必須スキル/
 * 単価/勤務地/開始日)もこのページ単体で確認できるようにする — ランキング
 * に戻らないと案件側の条件が見えない、という状態を避けるため。
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

  // matchProjectToEngineers()/matchEngineerToProjects()と同じ除外条件
  // (同一会社・商流が「貴社」止まり)に該当する組み合わせは、ランキングには
  // そもそも出てこないが、直接URLを開いた場合等のために、ここでもスコアを
  // 「マッチング対象外」として明示する(既存のスコアリングロジック自体は
  // 変更しない — 表示を抑えるだけ)。
  const isExcluded =
    isSameSourceCompany(project.sourceCompany, engineer.companyName) ||
    isClientOnlyCommercialFlow(project.commercialFlow);

  const { totalScore, breakdown } = calcTotalScore(toProjectInput(project), toEngineerInput(engineer));

  return (
    <>
      <h1>{resolveDisplayName('engineer', engineer.id, engineer.engineerName, useReal)}</h1>
      {useReal && engineer.engineerName && (
        <p className="empty-note" style={{ fontSize: '0.75rem' }}>
          ID: {engineer.id}
        </p>
      )}

      <div className="card-row">
        <Link to={`/matching/${project.id}`}>← ランキングに戻る</Link>
      </div>

      <div className="card">
        <div className="card-title">
          案件: {resolveDisplayName('project', project.id, project.projectName, useReal)}
        </div>
        {useReal && (
          <>
            <div className="card-row">
              <span>案件出し会社</span>
              <span>{project.sourceCompany ?? '未記載'}</span>
            </div>
            <div className="card-row">
              <span>商流</span>
              <span>{project.commercialFlow ?? '商流情報なし'}</span>
            </div>
          </>
        )}
        {project.requiredSkills.length > 0 && (
          <div>
            {project.requiredSkills.map((skill) => (
              <span key={skill.name} className={`skill-tag ${skill.required ? 'required' : ''}`}>
                {skill.name}
                {skill.required ? '(必須)' : '(歓迎)'} {skill.minYears}年+
              </span>
            ))}
          </div>
        )}
        <div className="card-row">
          <span>単価</span>
          <span>
            {project.rateMin}〜{project.rateMax}万円/月
          </span>
        </div>
        <div className="card-row">
          <span>勤務地</span>
          <span>
            {project.location} / {project.remoteAllowed ? 'リモート可' : '出社'}
          </span>
        </div>
        <div className="card-row">
          <span>開始日</span>
          <span>{formatDateValue(project.startDate)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">総合スコア</div>
        {isExcluded ? (
          <p className="empty-note">
            この組み合わせはマッチング対象外です(
            {isSameSourceCompany(project.sourceCompany, engineer.companyName) ? '同一会社' : '商流が貴社止まり'})。
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">候補者情報</div>
        {useReal && (
          <>
            <div className="card-row">
              <span>会社名</span>
              <span>{engineer.companyName ?? '未記載'}</span>
            </div>
            <div className="card-row">
              <span>商流</span>
              <span>{engineer.commercialFlow ?? '商流情報なし'}</span>
            </div>
          </>
        )}
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
