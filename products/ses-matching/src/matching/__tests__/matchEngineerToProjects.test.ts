import { toEngineerInput } from '../../intake/engineer';
import { toProjectInput } from '../../intake/project';
import type { EngineerRecord, ProjectRecord } from '../../intake/types';
import { calcTotalScore } from '../../scoring/totalScore';
import { matchEngineerToProjects } from '../matchEngineerToProjects';
import { matchProjectToEngineers } from '../matchProjectToEngineers';

// 匿名化したダミーデータ（実在の案件・要員ではない）
const engineer: EngineerRecord = {
  id: 'engineer-dummy-001',
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

// Java3年以上+AWS歓迎、単価・勤務地・稼働時期すべて希望通り -> 好条件
const projectA: ProjectRecord = {
  id: 'project-a',
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

// React必須(要員が未経験)、勤務地も希望外 -> 低条件
const projectB: ProjectRecord = {
  id: 'project-b',
  requiredSkills: [{ name: 'React', minYears: 2, required: true }],
  rateMin: 55,
  rateMax: 75,
  location: '大阪府',
  remoteAllowed: false,
  startDate: { precision: 'day', value: '2026-05-01' },
  japaneseLevel: 'business',
};

// Java必須のみ(AWSは要求しない)、単価・勤務地・稼働時期すべて希望通り -> 好条件
const projectC: ProjectRecord = {
  id: 'project-c',
  requiredSkills: [{ name: 'Java', minYears: 2, required: true }],
  rateMin: 65,
  rateMax: 70,
  location: '東京都',
  remoteAllowed: true,
  startDate: { precision: 'day', value: '2026-04-01' },
  japaneseLevel: 'business',
};

describe('matchEngineerToProjects', () => {
  it('複数(3件)の案件をスコアリングできる', () => {
    const results = matchEngineerToProjects(engineer, [projectA, projectB, projectC]);
    expect(results).toHaveLength(3);
  });

  it('projectIdが正しく保持される', () => {
    const results = matchEngineerToProjects(engineer, [projectA, projectB, projectC]);
    expect(results.map((r) => r.projectId).sort()).toEqual(['project-a', 'project-b', 'project-c'].sort());
  });

  it('スコア降順で並ぶ', () => {
    const results = matchEngineerToProjects(engineer, [projectB, projectA, projectC]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('projectsが空配列の場合は空配列を返す', () => {
    expect(matchEngineerToProjects(engineer, [])).toEqual([]);
  });

  it('既存Scoring Engine(calcTotalScore)の結果と一致する', () => {
    const results = matchEngineerToProjects(engineer, [projectA]);
    const expected = calcTotalScore(toProjectInput(projectA), toEngineerInput(engineer)).totalScore;
    expect(results[0].score).toBe(expected);
  });

  it('同じ組(project, engineer)であればmatchProjectToEngineers()と全く同じスコアになる(方向による差異が無い)', () => {
    const forward = matchProjectToEngineers(projectA, [engineer])[0].score;
    const reverse = matchEngineerToProjects(engineer, [projectA])[0].score;
    expect(reverse).toBe(forward);
  });

  it('最も条件の合わない案件は最下位になる', () => {
    const results = matchEngineerToProjects(engineer, [projectA, projectB, projectC]);
    expect(results[results.length - 1].projectId).toBe('project-b');
  });
});
