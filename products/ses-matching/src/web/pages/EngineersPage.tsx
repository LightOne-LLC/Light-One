import { dummyEngineers } from '../../demo/dummyData';
import { formatDateValue } from '../formatDateValue';

export function EngineersPage() {
  return (
    <>
      <h1>Engineers</h1>
      <p className="empty-note">要員一覧(ダミーデータ)</p>

      {dummyEngineers.length === 0 ? (
        <p className="empty-note">要員がいません。</p>
      ) : (
        dummyEngineers.map((engineer) => (
          <div key={engineer.id} className="card">
            <div className="card-title">{engineer.id}</div>
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
              <span>
                {engineer.desiredLocations.join(' / ')} / {engineer.remoteDesired ? 'リモート希望' : '出社可'}
              </span>
            </div>
            <div className="card-row">
              <span>稼働可能日</span>
              <span>{formatDateValue(engineer.availableFrom)}</span>
            </div>
          </div>
        ))
      )}
    </>
  );
}
