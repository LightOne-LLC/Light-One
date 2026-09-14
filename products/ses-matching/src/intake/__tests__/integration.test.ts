import { calcTotalScore } from '../../scoring/totalScore';
import { toEngineerInput, validateEngineerRecord } from '../engineer';
import { toProjectInput, validateProjectRecord } from '../project';
import type { EngineerRecord, ProjectRecord } from '../types';

// 匿名化したダミーデータ（実在の案件・要員ではない）
const dummyProject: ProjectRecord = {
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

const dummyEngineer: EngineerRecord = {
  id: 'engineer-dummy-001',
  skills: [
    { name: 'Java', years: 5 },
    { name: 'Amazon Web Services', years: 2 },
  ],
  desiredRateMin: 65,
  desiredRateMax: 75,
  desiredLocations: ['東京都'],
  remoteDesired: true,
  availableFrom: '2026-04-01',
  japaneseLevel: 'business',
};

describe('外部データ → validation → Scoring Engine', () => {
  it('検証を通過したProjectRecord/EngineerRecordをScoring Engineへ渡しスコアが返る', () => {
    const projectResult = validateProjectRecord(dummyProject);
    const engineerResult = validateEngineerRecord(dummyEngineer);

    expect(projectResult.valid).toBe(true);
    expect(engineerResult.valid).toBe(true);
    if (!projectResult.valid || !engineerResult.valid) return;

    const project = toProjectInput(projectResult.value);
    const engineer = toEngineerInput(engineerResult.value);

    const result = calcTotalScore(project, engineer);

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.breakdown.skillScore).toBe(1);
  });

  it('不正なProjectRecordはScoring Engineに渡す前に拒否される', () => {
    const invalidProject = { ...dummyProject, rateMin: -1 };
    const projectResult = validateProjectRecord(invalidProject);
    expect(projectResult.valid).toBe(false);
  });
});
