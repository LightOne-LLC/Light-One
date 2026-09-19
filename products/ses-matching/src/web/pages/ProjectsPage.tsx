import { Link } from 'react-router-dom';
import { dummyProjects } from '../../demo/dummyData';
import { fieldLabel } from '../fieldLabels';
import { formatDateValue } from '../formatDateValue';
import { useWorkspace } from '../workspaceContext';

export function ProjectsPage() {
  const { result, dataReady } = useWorkspace();
  // 取得に成功した後は、たとえ0件でもdummy dataへは戻さない
  // (dataReadyで判断する。件数では判断しない)。
  const realProjects = dataReady && result?.success ? (result.projects ?? []) : undefined;

  if (realProjects) {
    return (
      <>
        <h1>Projects</h1>
        <p className="empty-note">実Gmail取り込み結果の案件一覧です。</p>

        {realProjects.length === 0 && <p className="empty-note">案件がありません。</p>}
        {realProjects.map((project) => (
          <div key={project.id} className="card">
            <div className="card-title">{project.title ?? `案件ID: ${project.id}`}</div>
            {project.title && (
              <div className="empty-note" style={{ fontSize: '0.75rem' }}>
                ID: {project.id}
              </div>
            )}
            {project.skills.length > 0 && (
              <div>
                {project.skills.map((name) => (
                  <span key={name} className="skill-tag">
                    {name}
                  </span>
                ))}
              </div>
            )}
            {(project.rateMin !== undefined || project.rateMax !== undefined) && (
              <div className="card-row">
                <span>単価</span>
                <span>
                  {project.rateMin ?? '?'}〜{project.rateMax ?? '?'}万円/月
                </span>
              </div>
            )}
            {project.location && (
              <div className="card-row">
                <span>勤務地</span>
                <span>
                  {project.location}
                  {project.remoteAllowed !== undefined ? ` / ${project.remoteAllowed ? 'リモート可' : '出社'}` : ''}
                </span>
              </div>
            )}
            {project.startDate && (
              <div className="card-row">
                <span>開始日</span>
                <span>{formatDateValue(project.startDate)}</span>
              </div>
            )}
            <div className="card-row">
              <span>{project.validation.valid ? '✓ Matching可能' : '⚠ 情報不足'}</span>
            </div>
            {!project.validation.valid && project.validation.errors.length > 0 && (
              <ul className="empty-note">
                {project.validation.errors.map((field) => (
                  <li key={field}>不足: {fieldLabel(field)}</li>
                ))}
              </ul>
            )}
            {project.validation.valid && (
              <div className="card-row">
                <Link to={`/matching/${project.id}`}>候補を見る →</Link>
              </div>
            )}
          </div>
        ))}
      </>
    );
  }

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
