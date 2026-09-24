import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GmailBulkImportResult } from '../../server/types';
import { QuickMatch } from '../components/QuickMatch';
import { WorkspaceProvider } from '../workspaceContext';

// 今回の実案件(要求仕様に明記されたサンプル)。個人名・電話番号等の
// PIIは含まれない、案件条件のみのテキスト。
const REAL_PROJECT_SAMPLE = `お世話になっております。
こちら急ぎの案件となります🙇‍♀️
よろしくお願いいたします。
先週面談しましたが、見送りや他決で決まりませんでした。
本日か明日で面談できる人を優先します。
※外部設計がしっかりしていない現場なので、それでも詳細設計以降を問題なくやれる方を求めております。事前にご確認をお願いします。
65歳までOKです！
＝＝＝＝＝＝＝＝＝＝＝
■概要　　：駐車場管理システム新規構築(AS400)
■就業時間：9:30～18:30　休憩60分
■スキル　：開発～結合テストフェーズ
　　　　　　ILE-RPGの開発経験
　　　　　　※コミュニケーション能力と積極的に動ける方
　　　　　　仕訳関連知識(尚可)
■作業内容：製造，結合テスト等
■期間　　：2026年10月～2026月12月(延長の可能性大)
■作業場所：(最寄駅：大門，芝公園，浜松町)  or  在宅(週２～3日)
■要員数　：1名
■単価　　：55万円
　　　　　　※140H～190H 時間精算 中間割り
■面談　　：1回（上位との面談）
■年齢　　：50歳代希望(製造に自信があれば60歳代前半の検討可）
＝＝＝＝＝＝＝＝＝＝＝`;

const ENGINEER_SAMPLE = [
  '要員のご紹介です。',
  '氏名：山田太郎',
  '経歴：Java開発5年',
  'スキル：Java(5年)、AWS(2年)',
  '希望単価：70万円',
  '稼働可能日：即日',
  '希望勤務地：東京都',
  'リモート希望：あり',
].join('\n');

function mockFetchReject() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
}

function mockFetchResolve(result: GmailBulkImportResult) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(result),
    }),
  );
}

async function renderQuickMatch() {
  const view = render(
    <WorkspaceProvider>
      <QuickMatch />
    </WorkspaceProvider>,
  );
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  return view;
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText('案件・要員テキスト') as HTMLTextAreaElement;
}

function getAnalyzeButton() {
  return screen.getByRole('button', { name: /解析/ });
}

async function paste(text: string, override?: 'auto' | 'project' | 'engineer') {
  fireEvent.change(getTextarea(), { target: { value: text } });
  if (override) {
    fireEvent.change(screen.getByLabelText('判定方法'), { target: { value: override } });
  }
  fireEvent.click(getAnalyzeButton());
  await waitFor(() => expect(getAnalyzeButton().textContent).not.toBe('解析中…'));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QuickMatch', () => {
  it('⚡ Quick Matchセクションとtextarea、解析ボタンが表示される', async () => {
    mockFetchReject();
    await renderQuickMatch();
    expect(screen.getByText('⚡ Quick Match')).toBeTruthy();
    expect(getTextarea()).toBeTruthy();
    expect(screen.getByRole('button', { name: '解析してマッチング' })).toBeTruthy();
  });

  it('空入力で解析すると入力を促すエラーを表示する', async () => {
    mockFetchReject();
    await renderQuickMatch();
    fireEvent.click(getAnalyzeButton());
    await waitFor(() => expect(screen.getByText('テキストを入力してください。')).toBeTruthy());
  });

  it('クリック直後は解析中の状態を表示する', async () => {
    mockFetchReject();
    await renderQuickMatch();
    fireEvent.change(getTextarea(), { target: { value: REAL_PROJECT_SAMPLE } });
    fireEvent.click(getAnalyzeButton());
    expect(screen.getByRole('button', { name: '解析中…' })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('案件として解析しました').length).toBeGreaterThan(0));
  });

  it('自動判定だけで実案件サンプルをProjectとして正しく解析できる(detectEmailType強化後の回帰確認)', async () => {
    mockFetchReject();
    await renderQuickMatch();
    // 判定方法を明示的に切り替えず、デフォルトの「自動判定」のまま解析する。
    // 以前はこのサンプルが「要員数」「■スキル」等の語に引きずられてEngineer
    // に誤判定されていたが、detectEmailTypeの構造シグナル強化により
    // 自動判定だけで正しくProjectと判定されるようになったことを確認する。
    await paste(REAL_PROJECT_SAMPLE, 'auto');
    expect(screen.getByText('案件として解析しました')).toBeTruthy();
    expect(screen.getByText('55〜55万円/月')).toBeTruthy();
  });

  it('実案件サンプルを判定方法「案件」で解析すると、構造化結果とダミー要員とのマッチング候補を表示する(dummy data fallback)', async () => {
    mockFetchReject();
    await renderQuickMatch();
    await paste(REAL_PROJECT_SAMPLE, 'project');

    expect(screen.getByText('案件として解析しました')).toBeTruthy();
    expect(screen.getByText('55〜55万円/月')).toBeTruthy();
    expect(screen.getAllByText(/大門/).length).toBeGreaterThan(0);
    expect(screen.getByText('手持ち要員とのマッチング')).toBeTruthy();
    // dummyEngineers(engineer-a/engineer-b)が候補として表示される
    expect(screen.getAllByText(/engineer-/).length).toBeGreaterThan(0);
  });

  it('要員サンプルを判定方法「要員」で解析すると、構造化結果とダミー案件とのマッチング候補を表示する', async () => {
    mockFetchReject();
    await renderQuickMatch();
    await paste(ENGINEER_SAMPLE, 'engineer');

    expect(screen.getByText('要員として解析しました')).toBeTruthy();
    expect(screen.getByText('現在の案件とのマッチング')).toBeTruthy();
    expect(screen.getAllByText(/project-/).length).toBeGreaterThan(0);
  });

  it('自動判定(auto)は既存detectEmailTypeの判定に従う', async () => {
    mockFetchReject();
    await renderQuickMatch();
    await paste(ENGINEER_SAMPLE, 'auto');
    expect(screen.getByText('要員として解析しました')).toBeTruthy();
  });

  it('案件/要員どちらの強いシグナルも無いテキストはparse failureを表示する', async () => {
    mockFetchReject();
    await renderQuickMatch();
    await paste('来週の定例MTGの件、よろしくお願いします。', 'auto');
    expect(screen.getByText(/判定できませんでした/)).toBeTruthy();
  });

  it('必須項目が不足しているテキストはvalidationエラーを表示する', async () => {
    mockFetchReject();
    await renderQuickMatch();
    await paste(['案件のご紹介です。', '必須スキル：Java'].join('\n'), 'project');
    expect(screen.getByText('案件として解析しましたが、情報が不足しています')).toBeTruthy();
  });

  it('候補の「詳細」をクリックするとスコア内訳(スキル/単価/勤務地/タイミング)を表示する', async () => {
    mockFetchReject();
    await renderQuickMatch();
    await paste(REAL_PROJECT_SAMPLE, 'project');

    const detailButtons = screen.getAllByRole('button', { name: '詳細' });
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);
    expect(screen.getAllByText(/スキル/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/勤務地/).length).toBeGreaterThan(0);
    expect(screen.getByText(/タイミング/)).toBeTruthy();
  });

  it('「もう一度解析」で同じテキストを再解析できる', async () => {
    mockFetchReject();
    await renderQuickMatch();
    await paste(REAL_PROJECT_SAMPLE, 'project');
    expect(screen.getByRole('button', { name: 'もう一度解析' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'もう一度解析' }));
    await waitFor(() => expect(screen.getByText('案件として解析しました')).toBeTruthy());
  });

  it('実データWorkspace取得成功時は、そのvalidEngineersを使ってマッチングする(既存Workspaceをそのまま利用)', async () => {
    mockFetchResolve({
      success: true,
      limit: 500,
      fetched: 1,
      project: { total: 0, valid: 0, invalid: 0, datePrecision: { day: 0, month: 0, immediate: 0, unknown: 0, missing: 0 } },
      engineer: { total: 1, valid: 1, invalid: 0, datePrecision: { day: 0, month: 0, immediate: 0, unknown: 0, missing: 0 } },
      unparsed: 0,
      validationErrors: [],
      matching: { validProjects: 0, validEngineers: 1, matchableProjects: 0 },
      projects: [],
      validProjects: [],
      validEngineers: [
        {
          id: 'real-engineer-001',
          engineerName: '実データ要員',
          skills: [{ name: 'ILE-RPG', years: 3 }],
          desiredRateMin: 50,
          desiredRateMax: 60,
          desiredLocations: ['東京都'],
          remoteDesired: true,
          availableFrom: { precision: 'immediate', value: '' },
        },
      ],
    });
    await renderQuickMatch();
    await paste(REAL_PROJECT_SAMPLE, 'project');
    expect(screen.getByText('実データ要員')).toBeTruthy();
  });
});
