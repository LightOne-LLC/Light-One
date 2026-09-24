import { Link } from 'react-router-dom';
import type { DatePrecisionCounts, GmailBulkImportResult } from '../../server/types';
import { scoreColorClass } from '../scoreColor';
import { useWorkspace } from '../workspaceContext';

function DatePrecisionRow({ label, counts }: { label: string; counts: DatePrecisionCounts }) {
  return (
    <div className="card-row">
      <span>{label}</span>
      <span>
        日付: {counts.day} / 月: {counts.month} / 即日: {counts.immediate} / 不明: {counts.unknown + counts.missing}
      </span>
    </div>
  );
}

/**
 * 取得成功時の集計結果表示。呼び出し側(GmailBulkImport本体)がすでに
 * status==='success'(つまりresult.success===true)の場合のみ描画するため、
 * 失敗時の分岐は持たない — result.reason(内部のエラー文言)をそのまま
 * 画面に出す経路を作らないための境界。失敗表示は本体側の安全な汎用
 * メッセージのみで行う。
 */
function ResultView({ result }: { result: GmailBulkImportResult }) {
  return (
    <>
      <div className="card-row">
        <span>取得件数</span>
        <span>{result.fetched ?? 0}</span>
      </div>
      <div className="card-row">
        <span>案件</span>
        <span>{result.project?.total ?? 0}</span>
      </div>
      <div className="card-row">
        <span>BP要員</span>
        <span>{result.engineer?.total ?? 0}</span>
      </div>
      <div className="card-row">
        <span>未分類</span>
        <span>{result.unparsed ?? 0}</span>
      </div>
      {result.project?.datePrecision && <DatePrecisionRow label="案件: 開始時期" counts={result.project.datePrecision} />}
      {result.engineer?.datePrecision && (
        <DatePrecisionRow label="要員: 稼働可能時期" counts={result.engineer.datePrecision} />
      )}
      <div className="card-row">
        <span>案件 Validation PASS / FAIL</span>
        <span>
          {result.project?.valid ?? 0} / {result.project?.invalid ?? 0}
        </span>
      </div>
      <div className="card-row">
        <span>要員 Validation PASS / FAIL</span>
        <span>
          {result.engineer?.valid ?? 0} / {result.engineer?.invalid ?? 0}
        </span>
      </div>
      <div className="card-row">
        <span>マッチング可能(案件 / 要員)</span>
        <span>
          {result.matching?.matchableProjects ?? 0} / {result.matching?.validEngineers ?? 0}
        </span>
      </div>

      {result.validationErrors && Object.keys(result.validationErrors).length > 0 && (
        <div>
          <span className="card-row" style={{ display: 'block' }}>
            Validation FAIL理由:
          </span>
          {Object.entries(result.validationErrors)
            .sort(([, a], [, b]) => b - a)
            .map(([field, count]) => (
              <span key={field} className="skill-tag">
                {field}: {count}
              </span>
            ))}
        </div>
      )}

      <div>
        <span className="card-row" style={{ display: 'block' }}>
          実データMatching:
        </span>
        {result.matching?.sample && result.matching.sample.ranking.length > 0 ? (
          <>
            <div className="card-row">
              <span>Project</span>
              <span>{result.matching.sample.projectId}</span>
            </div>
            {result.matching.sample.ranking.map((r, i) => (
              <div key={r.engineerId} className="ranking-item">
                <span className="ranking-rank">{i + 1}</span>
                <span className="ranking-id">{r.engineerId}</span>
                <span className={`ranking-score ${scoreColorClass(r.score)}`}>{r.score}</span>
              </div>
            ))}
          </>
        ) : (
          <p className="empty-note">実メール上で有効なProjectとEngineerの同時成立なし</p>
        )}
      </div>

      {result.projects && result.projects.length > 0 && (
        <div className="card-row">
          <Link to="/projects">この結果をWorkspaceで見る(案件一覧) →</Link>
        </div>
      )}
    </>
  );
}

/**
 * Dashboardの取り込み状況表示 + 手動再取得UI。実データの取得自体は
 * WorkspaceProviderがPWA起動時(マウント時)に自動実行するため、ここでは
 * 共有state(workspaceContext)をそのまま表示するだけで、fetchロジックは
 * 一切重複実装しない。「直近3日間のメールを取得」ボタンも同じrefresh()を
 * 呼ぶ(初回の自動取得と手動再取得で、データフローを完全に統一する)。
 */
export function GmailBulkImport() {
  const { result, status, refresh } = useWorkspace();

  return (
    <div className="card">
      <div className="card-title">Gmail Import (直近3日間)</div>
      <button type="button" onClick={() => void refresh()} disabled={status === 'loading'}>
        直近3日間のメールを取得
      </button>
      <div className="card-row">
        <span>Status</span>
        <span>{status === 'idle' ? '未実行' : status === 'loading' ? '取得中…' : status === 'error' ? 'エラー' : '完了'}</span>
      </div>
      {status === 'error' && <p className="empty-note">実データを取得できませんでした</p>}
      {status === 'success' && result?.success && <ResultView result={result} />}
    </div>
  );
}
