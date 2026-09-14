import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GmailBulkImportResult } from '../../server/types';
import { GmailBulkImport } from '../components/GmailBulkImport';

function mockFetchOnce(result: GmailBulkImportResult) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(result),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GmailBulkImport', () => {
  it('取得ボタンが表示される', () => {
    render(<GmailBulkImport />);
    expect(screen.getByRole('button', { name: '直近50件を取得' })).toBeTruthy();
  });

  it('クリックすると/api/gmail/fetchをlimit付きで呼ぶ', async () => {
    mockFetchOnce({ success: true, fetched: 0 });
    render(<GmailBulkImport />);
    fireEvent.click(screen.getByRole('button', { name: '直近50件を取得' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/gmail/fetch?limit=50'));
  });

  it('集計結果(件数・分類・Validation・マッチング可能数)を表示する', async () => {
    mockFetchOnce({
      success: true,
      limit: 50,
      fetched: 50,
      project: { total: 10, valid: 3, invalid: 7 },
      engineer: { total: 31, valid: 5, invalid: 26 },
      unparsed: 9,
      validationErrors: { startDate: 6, availableFrom: 20, rate: 2 },
      matching: { validProjects: 3, validEngineers: 5, matchableProjects: 3 },
    });

    render(<GmailBulkImport />);
    fireEvent.click(screen.getByRole('button', { name: '直近50件を取得' }));

    await waitFor(() => expect(screen.getByText('50')).toBeTruthy());
    expect(screen.getByText('10', { exact: true })).toBeTruthy();
    expect(screen.getByText('31')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy(); // 未分類
    expect(screen.getByText('8')).toBeTruthy(); // PASS合計 3+5
    expect(screen.getByText('33')).toBeTruthy(); // FAIL合計 7+26
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

    render(<GmailBulkImport />);
    fireEvent.click(screen.getByRole('button', { name: '直近50件を取得' }));

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

    render(<GmailBulkImport />);
    fireEvent.click(screen.getByRole('button', { name: '直近50件を取得' }));

    await waitFor(() => expect(screen.getByText('マッチング可能(案件)')).toBeTruthy());
    expect(screen.queryByText(/Validation FAIL理由/)).toBeNull();
  });

  it('マッチングサンプルのランキングを表示する', async () => {
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

    render(<GmailBulkImport />);
    fireEvent.click(screen.getByRole('button', { name: '直近50件を取得' }));

    await waitFor(() => expect(screen.getByText(/サンプルランキング/)).toBeTruthy());
    expect(screen.getByText('email-engineer-1')).toBeTruthy();
    expect(screen.getByText('90')).toBeTruthy();
    expect(screen.getByText('email-engineer-2')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('取得失敗時はエラーメッセージを表示する', async () => {
    mockFetchOnce({ success: false, reason: 'mailbox is empty' });

    render(<GmailBulkImport />);
    fireEvent.click(screen.getByRole('button', { name: '直近50件を取得' }));

    await waitFor(() => expect(screen.getByText(/mailbox is empty/)).toBeTruthy());
  });

  it('API呼び出し自体が失敗した場合もエラー表示し画面を壊さない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    render(<GmailBulkImport />);
    fireEvent.click(screen.getByRole('button', { name: '直近50件を取得' }));

    await waitFor(() => expect(screen.getByText(/API呼び出しに失敗/)).toBeTruthy());
  });
});
