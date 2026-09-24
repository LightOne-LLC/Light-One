import type { EngineerSkill, RequiredSkill } from '../../../scoring/types';
import { getSkillFulfillment, scoreToIndicator } from '../skillFulfillment';

describe('getSkillFulfillment', () => {
  const requiredSkills: RequiredSkill[] = [
    { name: 'ILE-RPG', minYears: 2, required: true },
    { name: 'AS400', minYears: 1, required: true },
    { name: 'Docker', minYears: 1, required: false },
  ];

  it('経験年数が最低年数以上のスキルはfulfilled:trueになる', () => {
    const engineerSkills: EngineerSkill[] = [
      { name: 'ILE-RPG', years: 5 },
      { name: 'AS400', years: 3 },
    ];
    const result = getSkillFulfillment(requiredSkills, engineerSkills);
    expect(result.find((r) => r.name === 'ILE-RPG')?.fulfilled).toBe(true);
    expect(result.find((r) => r.name === 'AS400')?.fulfilled).toBe(true);
  });

  it('スキル自体が無ければfulfilled:falseになる', () => {
    const engineerSkills: EngineerSkill[] = [{ name: 'ILE-RPG', years: 5 }];
    const result = getSkillFulfillment(requiredSkills, engineerSkills);
    expect(result.find((r) => r.name === 'AS400')?.fulfilled).toBe(false);
    expect(result.find((r) => r.name === 'Docker')?.fulfilled).toBe(false);
  });

  it('経験年数が最低年数未満ならfulfilled:falseになる', () => {
    const engineerSkills: EngineerSkill[] = [{ name: 'ILE-RPG', years: 1 }];
    const result = getSkillFulfillment(requiredSkills, engineerSkills);
    expect(result.find((r) => r.name === 'ILE-RPG')?.fulfilled).toBe(false);
  });

  it('required(必須/尚可)の区別をそのまま保持する', () => {
    const result = getSkillFulfillment(requiredSkills, []);
    expect(result.find((r) => r.name === 'Docker')?.required).toBe(false);
    expect(result.find((r) => r.name === 'ILE-RPG')?.required).toBe(true);
  });
});

describe('scoreToIndicator', () => {
  it('0.8以上は◎', () => {
    expect(scoreToIndicator(0.8)).toBe('◎');
    expect(scoreToIndicator(1)).toBe('◎');
  });

  it('0.5以上0.8未満は○', () => {
    expect(scoreToIndicator(0.5)).toBe('○');
    expect(scoreToIndicator(0.79)).toBe('○');
  });

  it('0.5未満は△', () => {
    expect(scoreToIndicator(0)).toBe('△');
    expect(scoreToIndicator(0.49)).toBe('△');
  });
});
