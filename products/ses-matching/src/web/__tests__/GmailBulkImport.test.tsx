import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GmailBulkImportResult } from '../../server/types';
import { GmailBulkImport } from '../components/GmailBulkImport';
import { WorkspaceProvider } from '../workspaceContext';

function mockFetchOnce(result: GmailBulkImportResult) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(result),
    }),
  );
}

// GmailBulkImportはWorkspace state(Context)とWorkspaceへのリンク(Link)を
// 使うため、MatchingPage等と同じくRouter/Providerでラップして描画する。
// WorkspaceProviderはマウント時に自動でfetchするため、レンダリングした
// 時点で既に取得が始まっている(このモジュールの各テストは、その自動取得
// 自体をアサーションの対象として使う)。
function renderComponent() {
  return render(
    <MemoryRouter>
      <WorkspaceProvider>
        <GmailBulkImport />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GmailBulkImport', () => {
  it('取得ボタンが表示される', async () => {
    mockFetchOnce({ success: true, fetched: 0 });
    renderComponent();
    expect(screen.getByRole('button', { name: '最新データを取得' })).toBeTruthy();
    // マウント時の自動fetchが完了するのを待ってからテストを終える
    // (act()警告を避けるため)。
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it('マウント時に自動で/api/gmail/fetchをlimit=500付きで呼ぶ(手動クリック不要)', async () => {
    mockFetchOnce({ success: true, fetched: 0 });
    renderComponent();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/gmail/fetch?limit=500'));
  });

  it('「最新データを取得」ボタンをクリックすると再度同じAPIを呼ぶ', async () => {
    mockFetchOnce({ success: true, fetched: 0 });
    renderComponent();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '最新データを取得' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('集計結果(件数・分類・Validation PASS/FAIL・マッチング可能数)を表示する', async () => {
    mockFetchOnce({
      success: true,
      limit: 500,
      fetched: 50,
      project: { total: 10, valid: 3, invalid: 7 },
      engineer: { total: 31, valid: 5, invalid: 26 },
      unparsed: 9,
      validationErrors: { startDate: 6, availableFrom: 20, rate: 2 },
      matching: { validProjects: 3, validEngineers: 5, matchableProjects: 3 },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText('50')).toBeTruthy());
    expect(screen.getByText('10', { exact: true })).toBeTruthy();
    expect(screen.getByText('31')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy(); // 未分類
    expect(screen.getByText('3 / 7')).toBeTruthy(); // 案件 PASS/FAIL
    expect(screen.getByText('5 / 26')).toBeTruthy(); // 要員 PASS/FAIL
    expect(screen.getByText('3 / 5')).toBeTruthy(); // マッチング可能(案件/要員)
    expect(screen.getByText('availableFrom: 20')).toBeTruthy();
    expect(screen.getByText('startDate: 6')).toBeTruthy();
  });

  it('日付精度(day/month/immediate/不明)の集計を案件・要員それぞれ表示する', async () => {
    mockFetchOnce({
      success: true,
      fetched: 4,
      project: {
        total: 1,
        valid: 0,
        invalid: 1,
        datePrecision: { day: 0, month: 1, immediate: 0, unknown: 0, missing: 0 },
      },
      engineer: {
        total: 1,
        valid: 0,
        invalid: 1,
        datePrecision: { day: 0, month: 0, immediate: 1, unknown: 2, missing: 3 },
      },
      unparsed: 0,
      validationErrors: {},
      matching: { validProjects: 0, validEngineers: 0, matchableProjects: 0 },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText('案件: 開始時期')).toBeTruthy());
    expect(screen.getByText('要員: 稼働可能時期')).toBeTruthy();
    expect(screen.getByText(/月: 1/)).toBeTruthy();
    // unknown(2) + missing(3) = 5件を「不明」としてまとめて表示する。
    expect(screen.getByText(/不明: 5/)).toBeTruthy();
  });

  it('validation失敗理由が無ければその行を表示しない', async () => {
    mockFetchOnce({
      success: true,
      fetched: 0,
      project: { total: 0, valid: 0, invalid: 0 },
      engineer: { total: 0, valid: 0, invalid: 0 },
      unparsed: 0,
      validationErrors: {},
      matching: { validProjects: 0, validEngineers: 0, matchableProjects: 0 },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText('実データMatching:')).toBeTruthy());
    expect(screen.queryByText(/Validation FAIL理由/)).toBeNull();
  });

  it('実際のProject/Engineerが同時成立しない場合はその旨を明示する', async () => {
    mockFetchOnce({
      success: true,
      fetched: 5,
      project: { total: 2, valid: 1, invalid: 1 },
      engineer: { total: 3, valid: 0, invalid: 3 },
      unparsed: 0,
      validationErrors: {},
      matching: { validProjects: 1, validEngineers: 0, matchableProjects: 0 },
    });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByText('実メール上で有効なProjectとEngineerの同時成立なし')).toBeTruthy(),
    );
  });

  it('実データマッチングのランキングを表示する', async () => {
    mockFetchOnce({
      success: true,
      fetched: 3,
      project: { total: 1, valid: 1, invalid: 0 },
      engineer: { total: 2, valid: 2, invalid: 0 },
      unparsed: 0,
      validationErrors: {},
      matching: {
        validProjects: 1,
        validEngineers: 2,
        matchableProjects: 1,
        sample: {
          projectId: 'email-project-1',
          ranking: [
            { engineerId: 'email-engineer-1', score: 90 },
            { engineerId: 'email-engineer-2', score: 40 },
          ],
        },
      },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText('実データMatching:')).toBeTruthy());
    expect(screen.getByText('email-project-1')).toBeTruthy();
    expect(screen.getByText('email-engineer-1')).toBeTruthy();
    expect(screen.getByText('90')).toBeTruthy();
    expect(screen.getByText('email-engineer-2')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('取り込んだ案件があればWorkspace(Projects)へのリンクを表示する', async () => {
    mockFetchOnce({
      success: true,
      fetched: 1,
      project: { total: 1, valid: 1, invalid: 0 },
      engineer: { total: 0, valid: 0, invalid: 0 },
      unparsed: 0,
      validationErrors: {},
      matching: { validProjects: 1, validEngineers: 0, matchableProjects: 0 },
      projects: [{ id: 'email-project-1', skills: [], validation: { valid: true, errors: [] } }],
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText(/この結果をWorkspaceで見る/)).toBeTruthy());
  });

  it('サーバーがsuccess:falseを返した場合は安全な汎用メッセージのみ表示する(理由は出さない)', async () => {
    mockFetchOnce({ success: false, reason: 'Gmail credentials are not configured. token.json missing.' });

    renderComponent();

    await waitFor(() => expect(screen.getByText('実データを取得できませんでした')).toBeTruthy());
    expect(screen.queryByText(/credentials|token\.json/)).toBeNull();
  });

  it('API呼び出し自体が失敗した場合も安全な汎用メッセージを表示し画面を壊さない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error: 10.0.0.1 unreachable')));

    renderComponent();

    await waitFor(() => expect(screen.getByText('実データを取得できませんでした')).toBeTruthy());
    expect(screen.queryByText(/network error|10\.0\.0\.1/)).toBeNull();
  });
});
