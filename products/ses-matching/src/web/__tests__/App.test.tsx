import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { dummyEngineers, dummyProjects } from '../../demo/dummyData';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';

// このスイートはdummy dataでのregressionを確認するためのものなので、
// 実データ自動読み込み(WorkspaceProviderのマウント時fetch)は常に失敗させ、
// dataReady=falseのままdummy dataへフォールバックさせる
// (実データ取得成功時のWorkspace表示はWorkspace.test.tsxで別途検証する)。
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderAt(path: string) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  // マウント時の自動fetchが失敗してエラー状態に落ち着くのを待ってから
  // dummy dataのアサーションを行う(act()警告を避け、実際の非同期完了後の
  // 状態を検証するため)。
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  return view;
}

describe('SES Matching PWA', () => {
  it('appが起動しDashboardが表示される', async () => {
    await renderAt('/');
    expect(screen.getByRole('heading', { name: 'SES Matching' })).toBeTruthy();
  });

  it('Dashboardに「1件取得」UIは表示されない(直近3日間の一括取得のみ)', async () => {
    await renderAt('/');
    expect(screen.queryByText(/Gmail Import \(1件\)/)).toBeNull();
    expect(screen.getByText(/Gmail Import \(直近3日間\)/)).toBeTruthy();
  });

  it('Projects一覧が表示される', async () => {
    await renderAt('/projects');
    for (const project of dummyProjects) {
      expect(screen.getByText(project.id)).toBeTruthy();
    }
  });

  it('Engineers一覧が表示される', async () => {
    await renderAt('/engineers');
    for (const engineer of dummyEngineers) {
      expect(screen.getByText(engineer.id)).toBeTruthy();
    }
  });

  it('Matching結果が既存Matching Engineの計算結果通りスコア順で表示される', async () => {
    const project = dummyProjects[0];
    await renderAt(`/matching/${project.id}`);

    const expected = matchProjectToEngineers(project, dummyEngineers);
    const renderedIds = screen.getAllByText(/^engineer-/).map((el) => el.textContent);
    const renderedScores = document.querySelectorAll('.ranking-score');

    expect(renderedIds).toEqual(expected.map((r) => r.engineerId));
    expect(Array.from(renderedScores).map((el) => Number(el.textContent))).toEqual(expected.map((r) => r.score));
  });

  it('起動直後はローディング表示になり、取得失敗後は安全な汎用メッセージ+再読み込みボタンを表示する(内部エラー詳細は出さない)', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve))),
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('Gmailから案件・要員を読み込んでいます…')).toBeTruthy();

    resolveFetch({
      json: () =>
        Promise.resolve({
          success: false,
          reason: 'Gmail credentials are not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.',
        }),
    });

    // バナーとGmailBulkImport本体の両方に同じ安全な汎用メッセージが出る。
    await waitFor(() => expect(screen.getAllByText('実データを取得できませんでした').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeTruthy();
    // 内部のエラー理由(credentials等の言及)は画面のどこにも出ない。
    expect(screen.queryByText(/credentials|GOOGLE_CLIENT/)).toBeNull();
  });
});
