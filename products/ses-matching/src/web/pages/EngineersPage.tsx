import { dummyEngineers } from '../../demo/dummyData';
import { formatDateValue } from '../formatDateValue';
import { useWorkspace } from '../workspaceContext';

export function EngineersPage() {
  const { result, dataReady } = useWorkspace();
  // 取得に成功した後は、たとえ0件でもdummy dataへは戻さない
  // (dataReadyで判断する。件数では判断しない)。EngineerRecordの形は
  // dummy dataと実データで完全に同じため、表示ロジック自体は共通化する。
  const usingReal = dataReady && result?.success === true;
  const engineers = usingReal ? (result.validEngineers ?? []) : dummyEngineers;

  return (
    <>
      <h1>Engineers</h1>
      <p className="empty-note">
        {usingReal
          ? '実Gmail取り込み結果の要員一覧です(Validation PASSしたBP Engineerのみ)。'
          : '要員一覧(ダミーデータ)'}
      </p>

      {engineers.length === 0 ? (
        <p className="empty-note">要員がいません。</p>
      ) : (
        engineers.map((engineer) => (
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
