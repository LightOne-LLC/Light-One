import { useState } from 'react';
import type { DatePrecisionCounts, GmailBulkImportResult } from '../../server/types';
import { scoreColorClass } from '../scoreColor';

type Status = 'idle' | 'loading' | 'done' | 'error';

const DEFAULT_LIMIT = 50;

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

function ResultView({ result }: { result: GmailBulkImportResult }) {
  if (!result.success) {
    return <p className="empty-note">取得失敗: {result.reason ?? '不明なエラー'}</p>;
  }

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
    </>
  );
}

/**
 * DashboardのGmail一括取り込みUI。既存のGmailImport(1件取得)とは別に、
 * サーバー側API(/api/gmail/fetch)を叩き、直近N件を分類・validation・
 * (可能なら)マッチングまで通した集計結果のみを表示する。Gmail認証情報や
 * メール本文/氏名/メールアドレスはここには一切来ない。
 */
export function GmailBulkImport() {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<GmailBulkImportResult | null>(null);

  const handleClick = async () => {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch(`/api/gmail/fetch?limit=${DEFAULT_LIMIT}`);
      const data: GmailBulkImportResult = await res.json();
      setResult(data);
      setStatus('done');
    } catch {
      setResult({ success: false, reason: 'API呼び出しに失敗しました。' });
      setStatus('error');
    }
  };

  return (
    <div className="card">
      <div className="card-title">Gmail Import (直近{DEFAULT_LIMIT}件)</div>
      <button type="button" onClick={handleClick} disabled={status === 'loading'}>
        直近{DEFAULT_LIMIT}件を取得
      </button>
      <div className="card-row">
        <span>Status</span>
        <span>{status === 'idle' ? '未実行' : status === 'loading' ? '取得中…' : status === 'error' ? 'エラー' : '完了'}</span>
      </div>
      {result && <ResultView result={result} />}
    </div>
  );
}
