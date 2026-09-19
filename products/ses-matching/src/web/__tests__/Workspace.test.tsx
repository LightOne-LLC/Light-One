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
//
// companyName/commercialFlowのデータモデル(実メール500件・要員134件の
// 監査結果に基づく):
// companyName = 「その要員情報を送信してきた会社名」(本文冒頭の名乗り・
// 署名からのみ抽出。要員本人の所属会社を推測するフィールドではない)。
// commercialFlow = 「所属：」欄の値をそのまま保持する契約形態の記述
// (「弊社フリーランス」等。会社名らしき文字列を含んでいても分離しない
// — companyNameとは完全に独立した別の抽出元を持つため)。
// realEngineerGoodは両方取得できたケース、realEngineerWeakはcompanyName
// が取得できなかった典型的なケース(実メールの過半数)を表す。
const realProject: ProjectRecord = {
  id: 'real-project-1',
  projectName: 'クラウド基盤構築案件',
  sourceCompany: '株式会社サンプルテック',
  commercialFlow: '貴社まで',
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
  // 本文冒頭の名乗り等から取得できた送信元会社名。案件側のsourceCompany
  // (株式会社サンプルテック)とは別の値にして、案件出し会社と要員の
  // companyNameが混同されていないことをテストで直接確認できるようにする。
  companyName: '株式会社キャリアビート',
  // 「所属：サクシード株式会社 社員」のような、会社名らしき文字列を含む
  // 値でも、companyNameへ分離せずそのままcommercialFlowとして保持する
  // (このfixtureはparser通過後のEngineerRecordを表す)。
  commercialFlow: 'サクシード株式会社 社員',
  skills: [{ name: 'Java', years: 5 }],
  desiredRateMin: 65,
  desiredRateMax: 75,
  desiredLocations: ['東京都'],
  remoteDesired: true,
  availableFrom: { precision: 'day', value: '2026-04-01' },
};

const realEngineerWeak: EngineerRecord = {
  id: 'real-engineer-weak',
  // 送信元会社名が本文から特定できなかった典型的なケース(実メールの
  // 過半数)。companyNameは設定せず、契約形態のみcommercialFlowとする。
  commercialFlow: '弊社フリーランス',
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
      sourceCompany: '株式会社サンプルテック',
      commercialFlow: '貴社まで',
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
    // 案件出し会社・商流も案件カードに表示される
    expect(screen.getByText('株式会社サンプルテック')).toBeTruthy();
    expect(screen.getByText('貴社まで')).toBeTruthy();

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

    // Matching画面上部で、案件出し会社・商流を確認できる(案件名/案件出し
    // 会社/商流→マッチング候補、を1画面で追えることの一部)。
    expect(screen.getByText('株式会社サンプルテック')).toBeTruthy();
    expect(screen.getByText('貴社まで')).toBeTruthy();
    // 候補カードでも、人材の会社名・商流を確認できる(案件出し会社とは
    // 別の値であり、混同していないことを直接確認する)。
    expect(screen.getByText(/株式会社キャリアビート/)).toBeTruthy();
    expect(screen.getByText(/サクシード株式会社 社員/)).toBeTruthy();

    // 候補をクリック → Engineer Detailでページタイトルが人材名になり、
    // スコア内訳が既存calcTotalScore()と一致する
    fireEvent.click(screen.getByText('エンジニアA'));
    const expectedBreakdown = calcTotalScore(toProjectInput(realProject), toEngineerInput(realEngineerGood));
    await waitFor(() => expect(screen.getByText('候補者情報')).toBeTruthy());

    expect(screen.getByRole('heading', { level: 1, name: 'エンジニアA' })).toBeTruthy();
    expect(screen.getByText('ID: real-engineer-good')).toBeTruthy();
    expect(screen.getByText(/クラウド基盤構築案件/)).toBeTruthy();
    // Engineer Detail上部で会社名・商流を確認できる(companyNameが案件側
    // sourceCompanyとは別の値であることも含めて直接確認する)。
    expect(screen.getByText('株式会社キャリアビート')).toBeTruthy();
    expect(screen.getByText('サクシード株式会社 社員')).toBeTruthy();

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
    // 会社名・商流も表示される。realEngineerGoodは送信元会社名を取得
    // できたケース、realEngineerWeakは取得できなかった典型的なケース
    // (会社名は未記載、商流に契約形態が入る)。
    // getByTextは一致が複数あると例外を投げるため、この1件ずつが通ること
    // 自体が「商流の値が会社名欄に重複して表示されていないこと」の確認
    // になる(会社名と商流を混同しない回帰確認)。
    expect(screen.getByText('株式会社キャリアビート')).toBeTruthy();
    expect(screen.getByText('サクシード株式会社 社員')).toBeTruthy();
    expect(screen.getByText('弊社フリーランス')).toBeTruthy();
    expect(screen.getAllByText('未記載').length).toBeGreaterThan(0);
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
