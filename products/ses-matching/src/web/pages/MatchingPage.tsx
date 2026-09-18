import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';
import { scoreColorClass } from '../scoreColor';
import { useMatchingPools } from '../useMatchingPools';

export function MatchingPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projectList, engineerPool, useReal } = useMatchingPools();

  const selectedProject = projectList.find((p) => p.id === projectId) ?? projectList[0];

  const results = useMemo(
    () => (selectedProject ? matchProjectToEngineers(selectedProject, engineerPool) : []),
    [selectedProject, engineerPool],
  );

  const engineerById = useMemo(() => new Map(engineerPool.map((e) => [e.id, e])), [engineerPool]);

  // UI上の絞り込みのみ(Matching Engineのscore自体は一切変更しない)。
  const [minScore, setMinScore] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);

  const filteredResults = results.filter((r) => {
    if (r.score < minScore) return false;
    if (remoteOnly && !engineerById.get(r.engineerId)?.remoteDesired) return false;
    return true;
  });

  return (
    <>
      <h1>Matching</h1>
      <p className="empty-note">
        {useReal
          ? '実Gmail取り込みデータで、既存Matching Engineが候補要員をスコア降順表示します。'
          : '案件を選ぶと、既存Matching Engineで候補要員をスコア降順表示します(現在はダミーデータ)。'}
      </p>

      {projectList.length === 0 ? (
        <p className="empty-note">案件がありません。</p>
      ) : (
        <select
          value={selectedProject?.id}
          onChange={(e) => navigate(`/matching/${e.target.value}`)}
          aria-label="案件を選択"
        >
          {projectList.map((project) => (
            <option key={project.id} value={project.id}>
              {project.id}
            </option>
          ))}
        </select>
      )}

      {results.length > 0 && (
        <div className="stat-row">
          <label>
            最低スコア
            <input
              type="number"
              value={minScore}
              min={0}
              max={100}
              aria-label="最低スコア"
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={remoteOnly}
              aria-label="リモート希望のみ"
              onChange={(e) => setRemoteOnly(e.target.checked)}
            />
            リモート希望のみ
          </label>
        </div>
      )}

      {filteredResults.length === 0 ? (
        <p className="empty-note">候補要員がいません。</p>
      ) : (
        filteredResults.map((result, index) => {
          const engineer = engineerById.get(result.engineerId);
          return (
            <div
              key={result.engineerId}
              className="ranking-item"
              style={{ flexWrap: 'wrap', cursor: selectedProject ? 'pointer' : 'default' }}
              onClick={() => selectedProject && navigate(`/matching/${selectedProject.id}/engineer/${result.engineerId}`)}
            >
              <span className="ranking-rank">{index + 1}</span>
              <span className="ranking-id">{result.engineerId}</span>
              <span className={`ranking-score ${scoreColorClass(result.score)}`}>{result.score}</span>
              {engineer && (
                <span style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {engineer.skills.map((s) => s.name).join(' / ')}
                  {engineer.desiredLocations.length > 0 ? ` ・ ${engineer.desiredLocations.join('/')}` : ''}
                  {` ・ ${engineer.desiredRateMin}〜${engineer.desiredRateMax}万円`}
                </span>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
