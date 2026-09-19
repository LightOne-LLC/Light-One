import { useWorkspace } from '../workspaceContext';

/**
 * PWA起動直後の自動データ読み込み状態を表示する最小限のバナー。全ページ
 * (App.tsx内、Routesの直前)に1箇所だけ置くことで、Dashboard/Projects/
 * Engineers/Matchingどこを開いていても一貫して状態が分かるようにする。
 *
 * 「実機で実データが取得できているのか、dummy dataへfallbackしているのか」
 * を切り分けるための最小限の診断表示を兼ねる(loading/success/errorの
 * 3状態をここで明示する)。dataReady(workspaceContext.tsxで
 * `status === 'success' && result?.success === true`として定義される
 * 単一の判定)がこの画面のsuccess/error分岐と完全に一致するようにし、
 * 各ページ側の実データ/dummy data切り替え(dataReady)とズレないようにする。
 *
 * 表示するのは常に安全な集計値のみ(件数)。メール本文・メールアドレス・
 * OAuth token・credentials・氏名等のPIIは一切表示しない
 * (result.reasonも内部のエラー文言を含み得るため画面には出さない)。
 */
export function WorkspaceStatusBanner() {
  const { status, result, dataReady, refresh } = useWorkspace();

  if (status === 'loading') {
    return <p className="empty-note">Gmailから案件・要員を読み込んでいます…</p>;
  }

  if (status === 'error') {
    return (
      <div className="card">
        <p className="empty-note">Gmail実データ: 取得失敗</p>
        <p className="empty-note">実データを取得できませんでした</p>
        <p className="empty-note">dummy dataを表示中</p>
        <button type="button" onClick={() => void refresh()}>
          再読み込み
        </button>
      </div>
    );
  }

  if (dataReady && result?.success) {
    return (
      <div className="card">
        <p className="empty-note">Gmail実データ: 読み込み済み(実データを表示中)</p>
        <div className="card-row">
          <span>Projects件数</span>
          <span>{result.project?.total ?? 0}</span>
        </div>
        <div className="card-row">
          <span>Engineers件数</span>
          <span>{result.engineer?.total ?? 0}</span>
        </div>
        <div className="card-row">
          <span>Valid Projects件数</span>
          <span>{result.project?.valid ?? 0}</span>
        </div>
        <div className="card-row">
          <span>Valid Engineers件数</span>
          <span>{result.engineer?.valid ?? 0}</span>
        </div>
      </div>
    );
  }

  return null;
}
