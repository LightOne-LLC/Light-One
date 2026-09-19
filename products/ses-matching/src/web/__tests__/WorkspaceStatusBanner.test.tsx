import { render, screen, waitFor } from '@testing-library/react';
import type { GmailBulkImportResult } from '../../server/types';
import { WorkspaceStatusBanner } from '../components/WorkspaceStatusBanner';
import { WorkspaceProvider } from '../workspaceContext';

// 「実機で実データが取得できているのか、dummy dataへfallbackしているのか」
// を切り分けるための診断表示なので、実データ/失敗/loadingの3状態を直接
// 検証する。表示するのは常に安全な集計値(件数)のみで、result.reason等の
// 内部エラー文言・PIIが画面に出ないことも合わせて確認する。

function mockFetchOnce(result: GmailBulkImportResult) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(result),
    }),
  );
}

function renderComponent() {
  return render(
    <WorkspaceProvider>
      <WorkspaceStatusBanner />
    </WorkspaceProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WorkspaceStatusBanner', () => {
  it('Gmail取得中はローディングメッセージを表示する', async () => {
    // 意図的に解決しないfetchで、loading状態を固定して確認する。
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    renderComponent();

    expect(screen.getByText('Gmailから案件・要員を読み込んでいます…')).toBeTruthy();
  });

  it('Gmail取得成功時は実データの件数(Projects/Engineers/Valid Projects/Valid Engineers)を表示する(real data表示)', async () => {
    mockFetchOnce({
      success: true,
      fetched: 50,
      project: { total: 10, valid: 3, invalid: 7, datePrecision: { day: 0, month: 0, immediate: 0, unknown: 0, missing: 0 } },
      engineer: { total: 31, valid: 5, invalid: 26, datePrecision: { day: 0, month: 0, immediate: 0, unknown: 0, missing: 0 } },
      unparsed: 9,
      validationErrors: {},
      matching: { validProjects: 3, validEngineers: 5, matchableProjects: 3 },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText('Gmail実データ: 読み込み済み(実データを表示中)')).toBeTruthy());
    expect(screen.getByText('10')).toBeTruthy(); // Projects件数
    expect(screen.getByText('31')).toBeTruthy(); // Engineers件数
    expect(screen.getByText('3')).toBeTruthy(); // Valid Projects件数
    expect(screen.getByText('5')).toBeTruthy(); // Valid Engineers件数
  });

  it('サーバーがsuccess:falseを返した場合はGmail実データ取得失敗とdummy data表示中であることを明示する(理由は出さない)(dummy fallback / dummy data表示)', async () => {
    mockFetchOnce({
      success: false,
      reason: 'Gmail credentials are not configured. GOOGLE_CLIENT_ID missing.',
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText('Gmail実データ: 取得失敗')).toBeTruthy());
    expect(screen.getByText('実データを取得できませんでした')).toBeTruthy();
    expect(screen.getByText('dummy dataを表示中')).toBeTruthy();
    // 内部のエラー理由(credentials等の言及)は画面のどこにも出ない。
    expect(screen.queryByText(/credentials|GOOGLE_CLIENT/)).toBeNull();
  });

  it('API呼び出し自体が失敗した場合も同様にdummy data表示中であることを明示する(理由は出さない)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error: 10.0.0.1 unreachable')));

    renderComponent();

    await waitFor(() => expect(screen.getByText('Gmail実データ: 取得失敗')).toBeTruthy());
    expect(screen.getByText('dummy dataを表示中')).toBeTruthy();
    expect(screen.queryByText(/network error|10\.0\.0\.1/)).toBeNull();
  });
});
