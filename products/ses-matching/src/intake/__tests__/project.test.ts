import { toProjectInput, validateProjectRecord } from '../project';
import type { ProjectRecord } from '../types';

const validProject: ProjectRecord = {
  id: 'project-001',
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

describe('validateProjectRecord', () => {
  it('正常なProjectRecordを受け付ける', () => {
    const result = validateProjectRecord(validProject);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toEqual(validProject);
    }
  });

  it('必須項目(id)が存在しない場合は拒否する', () => {
    const { id: _id, ...rest } = validProject;
    const result = validateProjectRecord(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('id'))).toBe(true);
    }
  });

  it('必須項目(requiredSkills)が欠けている場合は拒否する', () => {
    const { requiredSkills: _skills, ...rest } = validProject;
    const result = validateProjectRecord(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('requiredSkills'))).toBe(true);
    }
  });

  it('単価が負数の場合は拒否する', () => {
    const result = validateProjectRecord({ ...validProject, rateMin: -10 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('rateMin'))).toBe(true);
    }
  });

  it('rateMin > rateMax の場合は拒否する', () => {
    const result = validateProjectRecord({ ...validProject, rateMin: 90, rateMax: 80 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('rateMaxを超える'))).toBe(true);
    }
  });

  it('不正な日付文字列の場合は拒否する', () => {
    const result = validateProjectRecord({ ...validProject, startDate: 'not-a-date' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('startDate'))).toBe(true);
    }
  });

  it('不正なjapaneseLevelの場合は拒否する', () => {
    const result = validateProjectRecord({ ...validProject, japaneseLevel: 'super-fluent' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('japaneseLevel'))).toBe(true);
    }
  });
});

describe('toProjectInput', () => {
  it('idを取り除きScoring Engine向けのProjectInputへ変換する', () => {
    const input = toProjectInput(validProject);
    expect(input).toEqual({
      requiredSkills: validProject.requiredSkills,
      rateMin: validProject.rateMin,
      rateMax: validProject.rateMax,
      location: validProject.location,
      remoteAllowed: validProject.remoteAllowed,
      startDate: validProject.startDate,
      japaneseLevel: validProject.japaneseLevel,
    });
    expect((input as Record<string, unknown>).id).toBeUndefined();
  });
});
