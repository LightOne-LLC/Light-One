import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GmailBulkImportResult } from '../server/types';

export type WorkspaceStatus = 'idle' | 'loading' | 'success' | 'error';

interface WorkspaceContextValue {
  result: GmailBulkImportResult | null;
  status: WorkspaceStatus;
  /** 実データ取得が成功したかどうか。成功後はたとえ0件でもdummy dataへ
   * フォールバックしない、という判断に使う一箇所の真実(single source of
   * truth)。個々のページはこのフラグだけを見ればよい。 */
  dataReady: boolean;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

/**
 * 実Gmail取り込み結果(既存 /api/gmail/fetch)を、ページ遷移をまたいで
 * Matching Workspace全体(Dashboard/Projects/Engineers/Matching/Engineer
 * Detail)で共有するための最小限のin-memory state。DBはまだ導入しない
 * ため、リロードで消える(ブラウザのタブ内メモリのみ)仕様で構わない。
 *
 * マウント時に一度だけ自動でrefresh()を実行する。取得に成功した後は、
 * たとえ結果が0件であってもdummy dataへは表示をフォールバックしない
 * (呼び出し側はresult/statusではなくdataReadyを見て判断する)。
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<GmailBulkImportResult | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>('idle');
  // loading中の重複fetch(ボタン連打、StrictModeの二重effect実行等)を防ぐ。
  // fetch開始時に同期的にtrueへ設定するため、非同期処理が終わる前に
  // 呼ばれた2回目の呼び出しは即座に無視される。
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('loading');
    try {
      const res = await fetch('/api/gmail/fetch');
      const data: GmailBulkImportResult = await res.json();
      setResult(data);
      // HTTP自体は成功していてもdata.successがfalseの場合(Gmail取得失敗等)
      // はerror状態として扱う。詳細な理由(data.reason)は画面には出さない
      // — 内部のエラー文言を安全にUIへ露出しないための境界。
      setStatus(data.success ? 'success' : 'error');
    } catch {
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // 初回mountで1回だけ自動取得する。StrictMode(開発時)はeffectを
    // mount→cleanup→再mountの順で2回実行するが、refresh()内のinFlight
    // フラグにより2回目は無視されるため、無限fetchや多重fetchにはならない。
    void refresh();
    // 初回マウント時のみ実行する意図的な設計のため空配列とする
    // (refreshはuseCallbackで参照が安定している)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dataReady = status === 'success' && result?.success === true;

  return (
    <WorkspaceContext.Provider value={{ result, status, dataReady, refresh }}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
