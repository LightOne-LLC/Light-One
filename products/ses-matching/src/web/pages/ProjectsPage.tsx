import { Link } from 'react-router-dom';
import { dummyProjects } from '../../demo/dummyData';
import { formatDateValue } from '../formatDateValue';

export function ProjectsPage() {
  return (
    <>
      <h1>Projects</h1>
      <p className="empty-note">案件一覧(ダミーデータ)</p>

      {dummyProjects.length === 0 ? (
        <p className="empty-note">案件がありません。</p>
      ) : (
        dummyProjects.map((project) => (
          <div key={project.id} className="card">
            <div className="card-title">{project.id}</div>
            <div>
              {project.requiredSkills.map((skill) => (
                <span key={skill.name} className={`skill-tag ${skill.required ? 'required' : ''}`}>
                  {skill.name}
                  {skill.required ? '(必須)' : '(歓迎)'} {skill.minYears}年+
                </span>
              ))}
            </div>
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
            <div className="card-row">
              <Link to={`/matching/${project.id}`}>候補を見る →</Link>
            </div>
          </div>
        ))
      )}
    </>
  );
}
