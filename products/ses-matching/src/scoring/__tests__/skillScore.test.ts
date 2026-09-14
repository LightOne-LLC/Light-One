import { calcSkillScore } from '../skillScore';
import { EngineerSkill, RequiredSkill } from '../types';

describe('calcSkillScore', () => {
  it('必須スキルを全て経験年数も含めて満たす場合は1.0', () => {
    const required: RequiredSkill[] = [
      { name: 'Java', minYears: 3, required: true },
      { name: 'Spring Boot', minYears: 2, required: true },
    ];
    const engineerSkills: EngineerSkill[] = [
      { name: 'Java', years: 5 },
      { name: 'SpringBoot', years: 2 },
    ];
    expect(calcSkillScore(required, engineerSkills)).toBe(1);
  });

  it('必須スキルの経験年数が不足している場合は満たしていない扱い', () => {
    const required: RequiredSkill[] = [{ name: 'Java', minYears: 5, required: true }];
    const engineerSkills: EngineerSkill[] = [{ name: 'Java', years: 2 }];
    expect(calcSkillScore(required, engineerSkills)).toBe(0);
  });

  it('必須スキル2件中1件のみ満たす場合は充足率0.5', () => {
    const required: RequiredSkill[] = [
      { name: 'Java', minYears: 3, required: true },
      { name: 'AWS', minYears: 2, required: true },
    ];
    const engineerSkills: EngineerSkill[] = [{ name: 'Java', years: 5 }];
    expect(calcSkillScore(required, engineerSkills)).toBe(0.5);
  });

  it('必須スキルを全て満たした上で尚可スキルも満たすとボーナスで加点される', () => {
    const required: RequiredSkill[] = [
      { name: 'Java', minYears: 3, required: true },
      { name: 'Docker', minYears: 1, required: false },
    ];
    const withoutBonus = calcSkillScore(
      [required[0]],
      [{ name: 'Java', years: 5 }],
    );
    const withBonus = calcSkillScore(required, [
      { name: 'Java', years: 5 },
      { name: 'Docker', years: 2 },
    ]);
    expect(withBonus).toBeGreaterThanOrEqual(withoutBonus);
    expect(withBonus).toBeLessThanOrEqual(1);
  });

  it('必須スキルが未設定の場合は尚可スキルの充足率で判定する', () => {
    const required: RequiredSkill[] = [{ name: 'Docker', minYears: 1, required: false }];
    expect(calcSkillScore(required, [{ name: 'Docker', years: 2 }])).toBe(1);
    expect(calcSkillScore(required, [])).toBe(0);
  });

  it('必要スキルが全く定義されていない場合は中立スコア0.5', () => {
    expect(calcSkillScore([], [{ name: 'Java', years: 5 }])).toBe(0.5);
  });

  it('表記ゆれのあるスキル名でも一致と判定する', () => {
    const required: RequiredSkill[] = [{ name: 'React', minYears: 1, required: true }];
    const engineerSkills: EngineerSkill[] = [{ name: 'ReactJS', years: 3 }];
    expect(calcSkillScore(required, engineerSkills)).toBe(1);
  });
});
