import { toEngineerInput } from '../../intake/engineer';
import { toProjectInput } from '../../intake/project';
import type { EngineerRecord, ProjectRecord } from '../../intake/types';
import { calcTotalScore } from '../../scoring/totalScore';
import { parseProjectCandidate } from '../../parser/parseEmail';
import { matchProjectToEngineers } from '../matchProjectToEngineers';

// 匿名化したダミーデータ（実在の案件・要員ではない）
const project: ProjectRecord = {
  id: 'project-dummy-001',
  requiredSkills: [
    { name: 'Java', minYears: 3, required: true },
    { name: 'AWS', minYears: 1, required: false },
  ],
  rateMin: 60,
  rateMax: 80,
  location: '東京都',
  remoteAllowed: true,
  startDate: { precision: 'day', value: '2026-04-01' },
  japaneseLevel: 'business',
};

// Java + AWS、単価・勤務地・稼働時期すべて希望通り -> 好条件
const engineerA: EngineerRecord = {
  id: 'engineer-a',
  skills: [
    { name: 'Java', years: 5 },
    { name: 'AWS', years: 3 },
  ],
  desiredRateMin: 70,
  desiredRateMax: 70,
  desiredLocations: ['東京都'],
  remoteDesired: true,
  availableFrom: { precision: 'day', value: '2026-04-01' },
  japaneseLevel: 'business',
};

// Javaのみ(AWS歓迎スキルなし)、稼働開始が大きく後ろ倒し -> 中程度
const engineerB: EngineerRecord = {
  id: 'engineer-b',
  skills: [{ name: 'Java', years: 4 }],
  desiredRateMin: 80,
  desiredRateMax: 80,
  desiredLocations: ['東京都'],
  remoteDesired: false,
  availableFrom: { precision: 'day', value: '2026-07-01' },
  japaneseLevel: 'business',
};

// Java + AWS、単価・勤務地・稼働時期すべて希望通り -> 好条件(Aとほぼ同条件)
const engineerC: EngineerRecord = {
  id: 'engineer-c',
  skills: [
    { name: 'Java', years: 6 },
    { name: 'AWS', years: 2 },
  ],
  desiredRateMin: 65,
  desiredRateMax: 65,
  desiredLocations: ['東京都'],
  remoteDesired: true,
  availableFrom: { precision: 'day', value: '2026-04-01' },
  japaneseLevel: 'business',
};

describe('matchProjectToEngineers', () => {
  it('複数(3人)の要員をスコアリングできる', () => {
    const results = matchProjectToEngineers(project, [engineerA, engineerB, engineerC]);
    expect(results).toHaveLength(3);
  });

  it('engineerIdが正しく保持される', () => {
    const results = matchProjectToEngineers(project, [engineerA, engineerB, engineerC]);
    expect(results.map((r) => r.engineerId).sort()).toEqual(['engineer-a', 'engineer-b', 'engineer-c'].sort());
  });

  it('スコア降順で並ぶ', () => {
    const results = matchProjectToEngineers(project, [engineerB, engineerA, engineerC]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('最高スコアの要員が1位になる', () => {
    const results = matchProjectToEngineers(project, [engineerB, engineerA, engineerC]);
    const bestByDirectCalc = [engineerA, engineerB, engineerC]
      .map((e) => ({
        id: e.id,
        score: calcTotalScore(toProjectInput(project), toEngineerInput(e)).totalScore,
      }))
      .sort((a, b) => b.score - a.score)[0];
    expect(results[0].engineerId).toBe(bestByDirectCalc.id);
  });

  it('engineersが空配列の場合は空配列を返す', () => {
    expect(matchProjectToEngineers(project, [])).toEqual([]);
  });

  it('同点の場合は元のengineers配列の順序を維持する(決定論的)', () => {
    const tiedX: EngineerRecord = { ...engineerA, id: 'tied-x' };
    const tiedY: EngineerRecord = { ...engineerA, id: 'tied-y' };
    const results = matchProjectToEngineers(project, [tiedX, tiedY]);
    expect(results[0].score).toBe(results[1].score);
    expect(results.map((r) => r.engineerId)).toEqual(['tied-x', 'tied-y']);
  });

  it('既存Scoring Engine(calcTotalScore)の結果と一致する', () => {
    const results = matchProjectToEngineers(project, [engineerA]);
    const expected = calcTotalScore(toProjectInput(project), toEngineerInput(engineerA)).totalScore;
    expect(results[0].score).toBe(expected);
  });

  it('E2E: ProjectRecord/EngineerRecordからランキングまで実行できる', () => {
    const results = matchProjectToEngineers(project, [engineerA, engineerB, engineerC]);
    expect(results.every((r) => r.score >= 0 && r.score <= 100)).toBe(true);
    expect(results[0].engineerId).not.toBe('engineer-b');
  });
});

describe('matchProjectToEngineers(同一会社の除外)', () => {
  it('案件のsourceCompanyと要員のcompanyNameが同一の場合、その要員は候補から除外される', () => {
    const sameCompanyProject: ProjectRecord = { ...project, sourceCompany: '株式会社ABC' };
    const sameCompanyEngineer: EngineerRecord = { ...engineerA, companyName: '株式会社ABC' };
    const results = matchProjectToEngineers(sameCompanyProject, [sameCompanyEngineer, engineerB]);
    expect(results.map((r) => r.engineerId)).toEqual(['engineer-b']);
  });

  it('会社名が異なる場合は通常どおり候補に残る', () => {
    const projectAbc: ProjectRecord = { ...project, sourceCompany: '株式会社ABC' };
    const engineerXyz: EngineerRecord = { ...engineerA, companyName: '株式会社XYZ' };
    const results = matchProjectToEngineers(projectAbc, [engineerXyz]);
    expect(results.map((r) => r.engineerId)).toEqual(['engineer-a']);
  });

  it('案件側にsourceCompanyが無ければ除外しない', () => {
    const engineerXyz: EngineerRecord = { ...engineerA, companyName: '株式会社XYZ' };
    const results = matchProjectToEngineers(project, [engineerXyz]);
    expect(results.map((r) => r.engineerId)).toEqual(['engineer-a']);
  });

  it('要員側にcompanyNameが無ければ除外しない', () => {
    const projectAbc: ProjectRecord = { ...project, sourceCompany: '株式会社ABC' };
    const results = matchProjectToEngineers(projectAbc, [engineerA]);
    expect(results.map((r) => r.engineerId)).toEqual(['engineer-a']);
  });
});

describe('matchProjectToEngineers(商流が「貴社」止まりの案件の除外)', () => {
  it('商流に「貴社まで」が含まれる案件は、どの要員に対しても空のランキングを返す', () => {
    const clientOnlyProject: ProjectRecord = { ...project, commercialFlow: '貴社まで' };
    const results = matchProjectToEngineers(clientOnlyProject, [engineerA, engineerB]);
    expect(results).toEqual([]);
  });

  it('商流に「貴社」が含まれる案件は除外される(「貴社まで」という厳密な一致でなくてもよい)', () => {
    const clientOnlyProject: ProjectRecord = { ...project, commercialFlow: '弊社→貴社' };
    const results = matchProjectToEngineers(clientOnlyProject, [engineerA]);
    expect(results).toEqual([]);
  });

  it('商流が「貴社」を含まなければ通常どおりマッチングする', () => {
    const normalFlowProject: ProjectRecord = { ...project, commercialFlow: '現場→弊社' };
    const results = matchProjectToEngineers(normalFlowProject, [engineerA]);
    expect(results.map((r) => r.engineerId)).toEqual(['engineer-a']);
  });

  it('商流が未設定の案件は除外しない', () => {
    const results = matchProjectToEngineers(project, [engineerA]);
    expect(results.map((r) => r.engineerId)).toEqual(['engineer-a']);
  });

  it('実データに見られる「貴社社員まで」「貴社プロパーまで」も除外される', () => {
    const syainMade: ProjectRecord = { ...project, commercialFlow: '貴社社員まで' };
    const properMade: ProjectRecord = { ...project, commercialFlow: '貴社プロパーまで' };
    expect(matchProjectToEngineers(syainMade, [engineerA])).toEqual([]);
    expect(matchProjectToEngineers(properMade, [engineerA])).toEqual([]);
  });

  it('商流の前後や内部に空白・改行があっても「貴社」を検出して除外する(表記揺れの正規化)', () => {
    const withSpaces: ProjectRecord = { ...project, commercialFlow: ' 貴社 まで ' };
    const withNewline: ProjectRecord = { ...project, commercialFlow: '貴社\nまで' };
    const withFullWidthSpace: ProjectRecord = { ...project, commercialFlow: '貴社　社員まで' };
    expect(matchProjectToEngineers(withSpaces, [engineerA])).toEqual([]);
    expect(matchProjectToEngineers(withNewline, [engineerA])).toEqual([]);
    expect(matchProjectToEngineers(withFullWidthSpace, [engineerA])).toEqual([]);
  });

  it('本文の挨拶文に「貴社」があるだけで、商流ラベルの値自体は通常の内容なら除外しない(本文全体を検索しているわけではないことの確認)', () => {
    // 実メールでよくある「貴社ますますご清栄の…」のような挨拶文を本文冒頭に
    // 持つが、「商流：」ラベルの値そのものには「貴社」が含まれないケース。
    const body = [
      '貴社ますますご清栄のこととお慶び申し上げます。',
      '下記案件のご紹介です。',
      '■必須スキル■',
      'Java',
      '■単価■',
      '60万円',
      '■場所■',
      '東京都',
      '■商流■',
      '現場→弊社',
    ].join('\n');
    const candidate = parseProjectCandidate('案件のご紹介', body, 'greeting-test');
    expect(candidate.commercialFlow).toBe('現場→弊社');

    const projectFromEmail: ProjectRecord = { ...project, commercialFlow: candidate.commercialFlow as string };
    const results = matchProjectToEngineers(projectFromEmail, [engineerA]);
    expect(results.map((r) => r.engineerId)).toEqual(['engineer-a']);
  });
});
