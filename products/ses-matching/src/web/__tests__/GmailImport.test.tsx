import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GmailImportResult } from '../../server/types';
import { GmailImport } from '../components/GmailImport';

function mockFetchOnce(result: GmailImportResult) {
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

describe('GmailImport', () => {
  it('Gmail Importボタンが表示される', () => {
    render(<GmailImport />);
    expect(screen.getByRole('button', { name: 'Gmailから1件取得' })).toBeTruthy();
  });

  it('クリック直後はloading状態を表示する', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve))),
    );

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    expect(screen.getByText('取得中…')).toBeTruthy();

    resolveFetch({ json: () => Promise.resolve({ success: true, type: 'unparsed', reason: 'x' }) });
    await waitFor(() => expect(screen.getByText('完了')).toBeTruthy());
  });

  it('project結果を表示する', async () => {
    mockFetchOnce({
      success: true,
      messageId: 'm1',
      from: 'agency@example.test',
      subject: '【新規案件】Javaエンジニア募集',
      type: 'project',
      extractedFields: ['requiredSkills', 'rateMin', 'rateMax', 'location'],
      validation: { valid: true, errors: [] },
      topCandidate: { engineerId: 'engineer-a', score: 100 },
    });

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    await waitFor(() => expect(screen.getByText('Project')).toBeTruthy());
    expect(screen.getByText('requiredSkills')).toBeTruthy();
    expect(screen.getByText('PASS')).toBeTruthy();
    expect(screen.getByText(/engineer-a/)).toBeTruthy();
  });

  it('engineer結果を表示する', async () => {
    mockFetchOnce({
      success: true,
      messageId: 'm2',
      subject: 'スキルシート送付の件',
      type: 'engineer',
      extractedFields: ['skills', 'desiredRateMin'],
      validation: { valid: true, errors: [] },
    });

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    await waitFor(() => expect(screen.getByText('Engineer')).toBeTruthy());
    expect(screen.getByText('skills')).toBeTruthy();
  });

  it('engineer結果のskillNamesを表示する(BP要員メールの■スキル抽出結果)', async () => {
    mockFetchOnce({
      success: true,
      messageId: 'm5',
      subject: '個人事業主のご紹介',
      type: 'engineer',
      extractedFields: ['skills'],
      skillNames: ['Java', 'Spring Boot', 'AWS'],
      validation: { valid: false, errors: ['desiredRateMin: 0以上の数値である必要があります'] },
    });

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    await waitFor(() => expect(screen.getByText('Engineer')).toBeTruthy());
    expect(screen.getByText('Java')).toBeTruthy();
    expect(screen.getByText('Spring Boot')).toBeTruthy();
    expect(screen.getByText('AWS')).toBeTruthy();
  });

  it('engineer結果のrateRangeを表示する(・単金（税抜）：の固定値抽出結果)', async () => {
    mockFetchOnce({
      success: true,
      messageId: 'm6',
      subject: '個人事業主のご紹介',
      type: 'engineer',
      extractedFields: ['skills'],
      skillNames: ['Java'],
      rateRange: { min: 80, max: 80 },
      validation: { valid: false, errors: ['availableFrom: 必須項目です'] },
    });

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    await waitFor(() => expect(screen.getByText('Engineer')).toBeTruthy());
    expect(screen.getByText('80万円')).toBeTruthy();
  });

  it('engineer結果のrateRangeを表示する(範囲の場合はmin〜max表記)', async () => {
    mockFetchOnce({
      success: true,
      messageId: 'm7',
      subject: '個人事業主のご紹介',
      type: 'engineer',
      extractedFields: ['skills'],
      skillNames: ['Java'],
      rateRange: { min: 65, max: 75 },
      validation: { valid: false, errors: ['availableFrom: 必須項目です'] },
    });

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    await waitFor(() => expect(screen.getByText('Engineer')).toBeTruthy());
    expect(screen.getByText('65万円〜75万円')).toBeTruthy();
  });

  it('unparsed結果を表示する', async () => {
    mockFetchOnce({
      success: true,
      messageId: 'm3',
      subject: '会議の日程調整について',
      type: 'unparsed',
      reason: 'could not determine whether this is a project or engineer email',
    });

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    await waitFor(() => expect(screen.getByText('Unparsed')).toBeTruthy());
    expect(screen.getByText(/could not determine/)).toBeTruthy();
  });

  it('API呼び出し失敗時にエラー表示し画面を壊さない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    render(<GmailImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Gmailから1件取得' }));

    await waitFor(() => expect(screen.getByText(/API呼び出しに失敗/)).toBeTruthy());
  });
});
