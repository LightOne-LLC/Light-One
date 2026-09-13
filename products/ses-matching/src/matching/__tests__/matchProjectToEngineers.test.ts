import { toEngineerInput } from '../../intake/engineer';
import { toProjectInput } from '../../intake/project';
import type { EngineerRecord, ProjectRecord } from '../../intake/types';
import { calcTotalScore } from '../../scoring/totalScore';
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
  startDate: '2026-04-01',
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
  availableFrom: '2026-04-01',
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
  availableFrom: '2026-07-01',
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
  availableFrom: '2026-04-01',
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
