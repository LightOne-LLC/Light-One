import { toEngineerInput, validateEngineerRecord } from '../engineer';
import type { EngineerRecord } from '../types';

const validEngineer: EngineerRecord = {
  id: 'engineer-001',
  skills: [
    { name: 'Java', years: 5 },
    { name: 'AWS', years: 2 },
  ],
  desiredRateMin: 65,
  desiredRateMax: 75,
  desiredLocations: ['東京都'],
  remoteDesired: true,
  availableFrom: '2026-04-01',
  japaneseLevel: 'business',
};

describe('validateEngineerRecord', () => {
  it('正常なEngineerRecordを受け付ける', () => {
    const result = validateEngineerRecord(validEngineer);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toEqual(validEngineer);
    }
  });

  it('必須項目(id)が存在しない場合は拒否する', () => {
    const { id: _id, ...rest } = validEngineer;
    const result = validateEngineerRecord(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('id'))).toBe(true);
    }
  });

  it('必須項目(skills)が欠けている場合は拒否する', () => {
    const { skills: _skills, ...rest } = validEngineer;
    const result = validateEngineerRecord(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('skills'))).toBe(true);
    }
  });

  it('希望単価が負数の場合は拒否する', () => {
    const result = validateEngineerRecord({ ...validEngineer, desiredRateMin: -5 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('desiredRateMin'))).toBe(true);
    }
  });

  it('desiredRateMin > desiredRateMax の場合は拒否する', () => {
    const result = validateEngineerRecord({ ...validEngineer, desiredRateMin: 100, desiredRateMax: 80 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('desiredRateMaxを超える'))).toBe(true);
    }
  });

  it('不正な日付文字列の場合は拒否する', () => {
    const result = validateEngineerRecord({ ...validEngineer, availableFrom: '2026-13-40' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('availableFrom'))).toBe(true);
    }
  });

  it('desiredLocationsが空文字を含む場合は拒否する', () => {
    const result = validateEngineerRecord({ ...validEngineer, desiredLocations: [''] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith('desiredLocations'))).toBe(true);
    }
  });
});

describe('toEngineerInput', () => {
  it('idを取り除きScoring Engine向けのEngineerInputへ変換する', () => {
    const input = toEngineerInput(validEngineer);
    expect(input).toEqual({
      skills: validEngineer.skills,
      desiredRateMin: validEngineer.desiredRateMin,
      desiredRateMax: validEngineer.desiredRateMax,
      desiredLocations: validEngineer.desiredLocations,
      remoteDesired: validEngineer.remoteDesired,
      availableFrom: validEngineer.availableFrom,
      japaneseLevel: validEngineer.japaneseLevel,
    });
    expect((input as Record<string, unknown>).id).toBeUndefined();
  });
});
