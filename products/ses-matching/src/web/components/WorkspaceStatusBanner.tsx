import { useWorkspace } from '../workspaceContext';

/**
 * PWA起動直後の自動データ読み込み状態を表示する最小限のバナー。全ページ
 * (App.tsx内、Routesの直前)に1箇所だけ置くことで、Dashboard/Projects/
 * Engineers/Matchingどこを開いていても一貫して状態が分かるようにする。
 *
 * loading中は簡潔な読み込み中メッセージ、失敗時は安全な汎用メッセージ
 * (内部のエラー詳細・認証情報・スタックトレース等は一切含めない)+
 * 再読み込みボタンを表示する。成功時(dataReady)は何も表示しない
 * (各ページ自身が実データを直接表示する)。
 */
export function WorkspaceStatusBanner() {
  const { status, refresh } = useWorkspace();

  if (status === 'loading') {
    return <p className="empty-note">Gmailから案件・要員を読み込んでいます…</p>;
  }

  if (status === 'error') {
    return (
      <div className="card">
        <p className="empty-note">実データを取得できませんでした</p>
        <button type="button" onClick={() => void refresh()}>
          再読み込み
        </button>
      </div>
    );
  }

  return null;
}
