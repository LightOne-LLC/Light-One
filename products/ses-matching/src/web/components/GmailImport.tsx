import { useState } from 'react';
import type { GmailImportResult } from '../../server/types';

type Status = 'idle' | 'loading' | 'done' | 'error';

const TYPE_LABEL: Record<NonNullable<GmailImportResult['type']>, string> = {
  project: 'Project',
  engineer: 'Engineer',
  unparsed: 'Unparsed',
};

function ResultView({ result }: { result: GmailImportResult }) {
  if (!result.success) {
    return <p className="empty-note">取得失敗: {result.reason ?? '不明なエラー'}</p>;
  }

  return (
    <>
      <div className="card-row">
        <span>From</span>
        <span>{result.from ?? '(none)'}</span>
      </div>
      <div className="card-row">
        <span>Subject</span>
        <span>{result.subject ?? '(none)'}</span>
      </div>
      <div className="card-row">
        <span>Type</span>
        <span>{result.type ? TYPE_LABEL[result.type] : '(unknown)'}</span>
      </div>

      {result.type === 'unparsed' && <p className="empty-note">Reason: {result.reason}</p>}

      {(result.type === 'project' || result.type === 'engineer') && (
        <>
          {result.extractedFields && result.extractedFields.length > 0 && (
            <div>
              <span className="card-row" style={{ display: 'block' }}>
                Extracted:
              </span>
              {result.extractedFields.map((field) => (
                <span key={field} className="skill-tag">
                  {field}
                </span>
              ))}
            </div>
          )}
          {result.skillNames && result.skillNames.length > 0 && (
            <div>
              <span className="card-row" style={{ display: 'block' }}>
                Skills:
              </span>
              {result.skillNames.map((name, i) => (
                <span key={`${name}-${i}`} className="skill-tag">
                  {name}
                </span>
              ))}
            </div>
          )}
          {result.rateRange && (
            <div className="card-row">
              <span>Rate</span>
              <span>
                {result.rateRange.min === result.rateRange.max
                  ? `${result.rateRange.min}万円`
                  : `${result.rateRange.min}万円〜${result.rateRange.max}万円`}
              </span>
            </div>
          )}
          <div className="card-row">
            <span>Validation</span>
            <span>{result.validation?.valid ? 'PASS' : 'FAIL'}</span>
          </div>
          {result.validation && !result.validation.valid && (
            <ul className="empty-note">
              {result.validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          {result.topCandidate && (
            <div className="card-row">
              <span>Top candidate</span>
              <span>
                {result.topCandidate.engineerId} — {result.topCandidate.score}
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}

/**
 * DashboardのGmail取り込みUI。サーバー側API(/api/gmail/fetch-one)を叩くだけで、
 * Gmail認証情報やメール本文はここには一切来ない。
 */
export function GmailImport() {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<GmailImportResult | null>(null);

  const handleClick = async () => {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch('/api/gmail/fetch-one');
      const data: GmailImportResult = await res.json();
      setResult(data);
      setStatus('done');
    } catch {
      setResult({ success: false, reason: 'API呼び出しに失敗しました。' });
      setStatus('error');
    }
  };

  return (
    <div className="card">
      <div className="card-title">Gmail Import</div>
      <button type="button" onClick={handleClick} disabled={status === 'loading'}>
        Gmailから1件取得
      </button>
      <div className="card-row">
        <span>Status</span>
        <span>{status === 'idle' ? '未実行' : status === 'loading' ? '取得中…' : status === 'error' ? 'エラー' : '完了'}</span>
      </div>
      {result && <ResultView result={result} />}
    </div>
  );
}
