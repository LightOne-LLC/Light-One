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

// 直近成功したGmail取り込み結果をタブ/ページ再読み込みをまたいで保持する
// ためだけのキャッシュ(新しいDB/APIは作らない、既存localStorageのみ)。
// Pull-to-refresh等のフルページリロードでは、このfile内のReact state
// (result/status)は必ず初期値へ戻る。7日分のGmail再取得には現在
// 1分前後かかるため、キャッシュが無いとその間ずっとdummy dataへ
// フォールバックしてしまう(「実データがサンプルデータに戻った」ように
// 見える主因)。キャッシュを即座に読み込むことでこれを避ける。
const STORAGE_KEY = 'ses-matching-workspace-result-v1';

function loadCachedResult(): GmailBulkImportResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GmailBulkImportResult;
    return parsed.success ? parsed : null;
  } catch {
    // private browsing等でlocalStorageが使えない/壊れている場合は
    // キャッシュ無しとして扱うだけで、アプリ自体は壊さない。
    return null;
  }
}

function saveCachedResult(data: GmailBulkImportResult): void {
  if (!data.success) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // クォータ超過等で保存できなくても、表示中のstateには影響させない。
  }
}

/**
 * 実Gmail取り込み結果(既存 /api/gmail/fetch)を、ページ遷移をまたいで
 * Matching Workspace全体(Dashboard/Projects/Engineers/Matching/Engineer
 * Detail)で共有するための最小限のstate。React state自体はこれまで通り
 * タブ内メモリのみ(DBは導入しない)だが、直近成功分だけを
 * localStorageへも書き出し、マウント時にまずそれを読み込むことで、
 * フルページリロード直後からdummy dataへ一時的にでも戻らないようにする。
 *
 * キャッシュが無い場合(初回アクセス等)は、これまで通りマウント時に
 * 自動でrefresh()を実行する。キャッシュがある場合は、既存の実データを
 * 表示したまま据え置き、毎回Gmailの7日分フル取得を強制することはしない
 * (必要であれば既存の手動更新ボタンがrefresh()を呼ぶ)。
 *
 * 取得に成功した後は、たとえ結果が0件であってもdummy dataへは表示を
 * フォールバックしない(呼び出し側はresult/statusではなくdataReadyを
 * 見て判断する)。
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
      if (data.success) saveCachedResult(data);
    } catch {
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // キャッシュがあれば即座にそれを使う(dummy dataへの一時フォール
    // バックを避ける)。無ければ、これまで通りマウント時に1回だけ自動
    // 取得する。StrictMode(開発時)はeffectをmount→cleanup→再mountの
    // 順で2回実行するが、refresh()内のinFlightフラグ、およびキャッシュ
    // 読み込み自体が冪等であることにより、2回目は無害化される。
    const cached = loadCachedResult();
    if (cached) {
      setResult(cached);
      setStatus('success');
      return;
    }
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
