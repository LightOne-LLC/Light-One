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

describe('matchEngineerToProjects(同一会社の除外)', () => {
  it('要員のcompanyNameと案件のsourceCompanyが同一の場合、その案件は候補から除外される', () => {
    const sameCompanyEngineer: EngineerRecord = { ...engineer, companyName: '株式会社ABC' };
    const sameCompanyProject: ProjectRecord = { ...projectA, sourceCompany: '株式会社ABC' };
    const results = matchEngineerToProjects(sameCompanyEngineer, [sameCompanyProject, projectB]);
    expect(results.map((r) => r.projectId)).toEqual(['project-b']);
  });

  it('会社名が異なる場合は通常どおり候補に残る', () => {
    const engineerAbc: EngineerRecord = { ...engineer, companyName: '株式会社ABC' };
    const projectXyz: ProjectRecord = { ...projectA, sourceCompany: '株式会社XYZ' };
    const results = matchEngineerToProjects(engineerAbc, [projectXyz]);
    expect(results.map((r) => r.projectId)).toEqual(['project-a']);
  });

  it('案件側にsourceCompanyが無ければ除外しない', () => {
    const engineerAbc: EngineerRecord = { ...engineer, companyName: '株式会社ABC' };
    const results = matchEngineerToProjects(engineerAbc, [projectA]);
    expect(results.map((r) => r.projectId)).toEqual(['project-a']);
  });

  it('要員側にcompanyNameが無ければ除外しない', () => {
    const projectAbc: ProjectRecord = { ...projectA, sourceCompany: '株式会社ABC' };
    const results = matchEngineerToProjects(engineer, [projectAbc]);
    expect(results.map((r) => r.projectId)).toEqual(['project-a']);
  });
});

describe('matchEngineerToProjects(商流が「貴社」止まりの案件の除外)', () => {
  it('商流に「貴社まで」が含まれる案件は候補から除外される', () => {
    const clientOnlyProject: ProjectRecord = { ...projectA, commercialFlow: '貴社まで' };
    const results = matchEngineerToProjects(engineer, [clientOnlyProject, projectB]);
    expect(results.map((r) => r.projectId)).toEqual(['project-b']);
  });

  it('商流が「貴社」を含まなければ通常どおり候補に残る', () => {
    const normalFlowProject: ProjectRecord = { ...projectA, commercialFlow: '現場→弊社' };
    const results = matchEngineerToProjects(engineer, [normalFlowProject]);
    expect(results.map((r) => r.projectId)).toEqual(['project-a']);
  });

  it('商流が未設定の案件は除外しない', () => {
    const results = matchEngineerToProjects(engineer, [projectA]);
    expect(results.map((r) => r.projectId)).toEqual(['project-a']);
  });
});
