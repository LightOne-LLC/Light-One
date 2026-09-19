import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { calcTotalScore } from '../../scoring/totalScore';
import { toEngineerInput } from '../../intake/engineer';
import { toProjectInput } from '../../intake/project';
import type { EngineerRecord, ProjectRecord } from '../../intake/types';
import type { GmailBulkImportResult } from '../../server/types';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';

// すべて匿名の合成(synthetic)データ。実Gmail/OAuthには一切アクセスしない
// (Dashboardのfetch呼び出しをモックして注入する)。

// realEngineerWeakはあえてengineerNameを設定しない — 人材名が取得できない
// 実メールのケース(内部IDフォールバック表示)を、既存の各テストの流れの中で
// 自然にカバーするため。
const realProject: ProjectRecord = {
  id: 'real-project-1',
  projectName: 'クラウド基盤構築案件',
  requiredSkills: [{ name: 'Java', minYears: 3, required: true }],
  rateMin: 60,
  rateMax: 80,
  location: '東京都',
  remoteAllowed: true,
  startDate: { precision: 'day', value: '2026-04-01' },
};

const realEngineerGood: EngineerRecord = {
  id: 'real-engineer-good',
  engineerName: 'エンジニアA',
  skills: [{ name: 'Java', years: 5 }],
  desiredRateMin: 65,
  desiredRateMax: 75,
  desiredLocations: ['東京都'],
  remoteDesired: true,
  availableFrom: { precision: 'day', value: '2026-04-01' },
};

const realEngineerWeak: EngineerRecord = {
  id: 'real-engineer-weak',
  skills: [{ name: 'PHP', years: 2 }],
  desiredRateMin: 100,
  desiredRateMax: 120,
  desiredLocations: ['大阪府'],
  remoteDesired: false,
  availableFrom: { precision: 'day', value: '2026-08-01' },
};

const bulkResult: GmailBulkImportResult = {
  success: true,
  limit: 50,
  fetched: 3,
  project: {
    total: 1,
    valid: 1,
    invalid: 0,
    datePrecision: { day: 1, month: 0, immediate: 0, unknown: 0, missing: 0 },
  },
  engineer: {
    total: 2,
    valid: 2,
    invalid: 0,
    datePrecision: { day: 2, month: 0, immediate: 0, unknown: 0, missing: 0 },
  },
  unparsed: 0,
  validationErrors: {},
  matching: { validProjects: 1, validEngineers: 2, matchableProjects: 1 },
  projects: [
    {
      id: 'real-project-1',
      title: 'AWSインフラ案件',
      skills: ['Java'],
      rateMin: 60,
      rateMax: 80,
      location: '東京都',
      remoteAllowed: true,
      startDate: { precision: 'day', value: '2026-04-01' },
      validation: { valid: true, errors: [] },
    },
  ],
  validProjects: [realProject],
  validEngineers: [realEngineerGood, realEngineerWeak],
};

function mockBulkFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(bulkResult),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Matching Workspace(実データがWorkspace全体を経由してEngineer Detailまで到達する)', () => {
  it('Gmail Bulk Import → Projects → Matching → Engineer Detail(スコア内訳)まで、同じimport結果を参照して遷移できる', async () => {
    mockBulkFetch();

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    // PWA起動時にWorkspaceProviderが自動で一括取得を行うため、
    // ボタンクリックは不要(手動再取得と同じrefresh()を使うのみ)。
    await waitFor(() => expect(screen.getByText('実データMatching:')).toBeTruthy());

    // Workspace(Projects)へ移動すると、dummyではなく実データの案件が表示される
    fireEvent.click(screen.getByText(/この結果をWorkspaceで見る/));
    await waitFor(() => expect(screen.getByText('AWSインフラ案件')).toBeTruthy());
    expect(screen.getByText('✓ Matching可能')).toBeTruthy();

    // 候補を見る → Matchingページで実Engineerのランキングが既存Matching
    // Engineeと一致する。名前が取得できたエンジニアは名前で、できなかった
    // エンジニアは内部IDフォールバック("人材ID: ...")で表示される
    // (内部IDは捨てず、フォールバック表示として保持する)。
    fireEvent.click(screen.getByText('候補を見る →'));
    await waitFor(() => expect(screen.getByText('エンジニアA')).toBeTruthy());
    expect(screen.getByText('人材ID: real-engineer-weak')).toBeTruthy();
    expect(screen.queryByText('real-engineer-good')).toBeNull();

    const expectedRanking = matchProjectToEngineers(realProject, [realEngineerGood, realEngineerWeak]);
    const renderedScores = Array.from(document.querySelectorAll('.ranking-score')).map((el) =>
      Number(el.textContent),
    );
    expect(renderedScores).toEqual(expectedRanking.map((r) => r.score));

    // 候補をクリック → Engineer Detailでページタイトルが人材名になり、
    // スコア内訳が既存calcTotalScore()と一致する
    fireEvent.click(screen.getByText('エンジニアA'));
    const expectedBreakdown = calcTotalScore(toProjectInput(realProject), toEngineerInput(realEngineerGood));
    await waitFor(() => expect(screen.getByText('候補者情報')).toBeTruthy());

    expect(screen.getByRole('heading', { level: 1, name: 'エンジニアA' })).toBeTruthy();
    expect(screen.getByText('ID: real-engineer-good')).toBeTruthy();
    expect(screen.getByText(/クラウド基盤構築案件/)).toBeTruthy();

    const totalScoreEl = document.querySelector('.ranking-score');
    expect(totalScoreEl?.textContent).toBe(String(expectedBreakdown.totalScore));

    const breakdownValues = Array.from(document.querySelectorAll('.card-row')).map((el) => el.textContent);
    expect(breakdownValues).toContain(`スキル${Math.round(expectedBreakdown.breakdown.skillScore * 100)}`);
    expect(breakdownValues).toContain(`単価${Math.round(expectedBreakdown.breakdown.rateScore * 100)}`);
    expect(breakdownValues).toContain(`勤務地${Math.round(expectedBreakdown.breakdown.locationScore * 100)}`);
    expect(breakdownValues).toContain(`タイミング${Math.round(expectedBreakdown.breakdown.timingScore * 100)}`);
  });

  async function renderWorkspaceAtRealMatching() {
    mockBulkFetch();
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/この結果をWorkspaceで見る/)).toBeTruthy());
    fireEvent.click(screen.getByText(/この結果をWorkspaceで見る/));
    await waitFor(() => expect(screen.getByText('候補を見る →')).toBeTruthy());
    fireEvent.click(screen.getByText('候補を見る →'));
    await waitFor(() => expect(screen.getByText('エンジニアA')).toBeTruthy());
  }

  it('最低スコアフィルタで候補を絞り込める(Matching Engineのscore自体は変更しない)', async () => {
    await renderWorkspaceAtRealMatching();
    expect(screen.getByText('人材ID: real-engineer-weak')).toBeTruthy();

    const expectedRanking = matchProjectToEngineers(realProject, [realEngineerGood, realEngineerWeak]);
    const weakScore = expectedRanking.find((r) => r.engineerId === 'real-engineer-weak')?.score ?? 0;

    fireEvent.change(screen.getByLabelText('最低スコア'), { target: { value: String(weakScore + 1) } });

    expect(screen.getByText('エンジニアA')).toBeTruthy();
    expect(screen.queryByText('人材ID: real-engineer-weak')).toBeNull();
  });

  it('リモート希望のみフィルタで、リモートを希望しない候補を除外できる', async () => {
    await renderWorkspaceAtRealMatching();
    expect(screen.getByText('人材ID: real-engineer-weak')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('リモート希望のみ'));

    expect(screen.getByText('エンジニアA')).toBeTruthy();
    expect(screen.queryByText('人材ID: real-engineer-weak')).toBeNull();
  });

  it('validationに失敗した案件は「⚠ 情報不足」と不足フィールドを表示し、候補は見られない', async () => {
    const invalidResult: GmailBulkImportResult = {
      ...bulkResult,
      matching: { validProjects: 0, validEngineers: 2, matchableProjects: 0 },
      projects: [
        {
          id: 'invalid-project-1',
          skills: [],
          validation: { valid: false, errors: ['requiredSkills', 'location', 'startDate'] },
        },
      ],
      validProjects: [],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(invalidResult) }));

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/この結果をWorkspaceで見る/)).toBeTruthy());

    fireEvent.click(screen.getByText(/この結果をWorkspaceで見る/));
    await waitFor(() => expect(screen.getByText('⚠ 情報不足')).toBeTruthy());
    expect(screen.getByText('不足: 必須スキル')).toBeTruthy();
    expect(screen.getByText('不足: 勤務地')).toBeTruthy();
    expect(screen.getByText('不足: 開始日')).toBeTruthy();
    expect(screen.queryByText('候補を見る →')).toBeNull();
    // titleが取得できていない案件は、内部IDを安全な文言で補って表示する
    // (idを完全に捨てず、フォールバックとして保持する)。
    expect(screen.getByText('案件ID: invalid-project-1')).toBeTruthy();
  });

  it('Engineersページで実データの人材名を表示し、取得できない場合は内部IDへフォールバックする', async () => {
    mockBulkFetch();
    render(
      <MemoryRouter initialEntries={['/engineers']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('エンジニアA')).toBeTruthy());
    expect(screen.getByText('人材ID: real-engineer-weak')).toBeTruthy();
    // 名前が表示されている候補は、内部IDも小さく併記する(デバッグ用途)。
    expect(screen.getByText('ID: real-engineer-good')).toBeTruthy();
  });

  it('実データが無い場合は既存dummy dataでのMatching(regression)が維持される', async () => {
    // 自動読み込み自体は常に実行されるが、失敗させてdataReady=falseのまま
    // dummy dataへフォールバックさせる(取得成功時の実データ表示は
    // 上記のテストで別途検証済み)。
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    render(
      <MemoryRouter initialEntries={['/projects']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('案件一覧(ダミーデータ)')).toBeTruthy();
  });

  it('存在しない案件/候補者のEngineer Detailは「見つかりません」を表示する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    render(
      <MemoryRouter initialEntries={['/matching/no-such-project/engineer/no-such-engineer']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('案件または候補者が見つかりません。')).toBeTruthy();
  });
});
