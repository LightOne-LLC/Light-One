import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dummyEngineers, dummyProjects } from '../../demo/dummyData';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';
import { scoreColorClass } from '../scoreColor';

export function MatchingPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const selectedProject = dummyProjects.find((p) => p.id === projectId) ?? dummyProjects[0];

  const results = useMemo(
    () => (selectedProject ? matchProjectToEngineers(selectedProject, dummyEngineers) : []),
    [selectedProject],
  );

  return (
    <>
      <h1>Matching</h1>
      <p className="empty-note">案件を選ぶと、既存Matching Engineで候補要員をスコア降順表示します。</p>

      {dummyProjects.length === 0 ? (
        <p className="empty-note">案件がありません。</p>
      ) : (
        <select
          value={selectedProject?.id}
          onChange={(e) => navigate(`/matching/${e.target.value}`)}
          aria-label="案件を選択"
        >
          {dummyProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.id}
            </option>
          ))}
        </select>
      )}

      {results.length === 0 ? (
        <p className="empty-note">候補要員がいません。</p>
      ) : (
        results.map((result, index) => (
          <div key={result.engineerId} className="ranking-item">
            <span className="ranking-rank">{index + 1}</span>
            <span className="ranking-id">{result.engineerId}</span>
            <span className={`ranking-score ${scoreColorClass(result.score)}`}>{result.score}</span>
          </div>
        ))
      )}
    </>
  );
}
