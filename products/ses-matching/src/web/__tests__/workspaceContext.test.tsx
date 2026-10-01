import { render, screen, waitFor } from '@testing-library/react';
import type { GmailBulkImportResult } from '../../server/types';
import { useWorkspace, WorkspaceProvider } from '../workspaceContext';

// Pull-to-refresh等のフルページリロード直後に、実データがdummy dataへ
// 一時的にでも戻って見える問題の修正対象(localStorageキャッシュの
// 読み込み・保存)だけを検証する。実Gmail/OAuthネットワークには一切
// アクセスしない。

const STORAGE_KEY = 'ses-matching-workspace-result-v1';

function mockFetchOnce(result: GmailBulkImportResult) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(result),
    }),
  );
}

function Probe() {
  const { result, status, dataReady } = useWorkspace();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="dataReady">{String(dataReady)}</span>
      <span data-testid="fetched">{result?.fetched ?? 'null'}</span>
    </div>
  );
}

function renderProbe() {
  return render(
    <WorkspaceProvider>
      <Probe />
    </WorkspaceProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('WorkspaceProvider(localStorageキャッシュ)', () => {
  it('キャッシュが無ければ、これまで通りマウント時に自動でfetchする', async () => {
    mockFetchOnce({ success: true, fetched: 42 });
    renderProbe();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/gmail/fetch'));
    await waitFor(() => expect(screen.getByTestId('fetched').textContent).toBe('42'));
    expect(screen.getByTestId('dataReady').textContent).toBe('true');
  });

  it('取得成功後、その結果がlocalStorageへ保存される', async () => {
    mockFetchOnce({ success: true, fetched: 7 });
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('fetched').textContent).toBe('7'));
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(cached?.success).toBe(true);
    expect(cached?.fetched).toBe(7);
  });

  it('取得失敗時はlocalStorageへ保存しない(壊れた/失敗結果をキャッシュしない)', async () => {
    mockFetchOnce({ success: false, reason: 'quota exceeded' });
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('マウント前にlocalStorageへ有効なキャッシュがあれば、fetchを呼ばずに即座にそれを使う(Pull-to-refresh等のフルページリロード直後でもdummy dataへ戻らない)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ success: true, fetched: 999 }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('dataReady').textContent).toBe('true'));
    expect(screen.getByTestId('fetched').textContent).toBe('999');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('localStorageのキャッシュがsuccess:falseの場合は使わず、通常どおり自動fetchする', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ success: false, reason: 'old failure' }));
    mockFetchOnce({ success: true, fetched: 5 });

    renderProbe();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/gmail/fetch'));
    await waitFor(() => expect(screen.getByTestId('fetched').textContent).toBe('5'));
  });

  it('localStorageの内容が壊れたJSONでもクラッシュせず、通常どおり自動fetchする', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    mockFetchOnce({ success: true, fetched: 3 });

    renderProbe();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/gmail/fetch'));
    await waitFor(() => expect(screen.getByTestId('fetched').textContent).toBe('3'));
  });
});
