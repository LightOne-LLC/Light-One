import { isSameSkill, normalizeSkillName } from '../normalize';

describe('normalizeSkillName', () => {
  it('表記ゆれのあるReact系スキルを同一の正規名にまとめる', () => {
    expect(normalizeSkillName('React')).toBe(normalizeSkillName('react.js'));
    expect(normalizeSkillName('React')).toBe(normalizeSkillName('ReactJS'));
  });

  it('大文字小文字・空白の違いを無視する', () => {
    expect(normalizeSkillName(' TypeScript ')).toBe(normalizeSkillName('typescript'));
  });

  it('Spring Bootの表記ゆれをまとめる', () => {
    expect(normalizeSkillName('Spring Boot')).toBe(normalizeSkillName('SpringBoot'));
  });

  it('辞書に無いスキル名も一貫した正規化結果を返す', () => {
    expect(normalizeSkillName('COBOL')).toBe(normalizeSkillName('cobol'));
  });
});

describe('isSameSkill', () => {
  it('表記ゆれがあっても同一スキルと判定する', () => {
    expect(isSameSkill('AWS', 'Amazon Web Services')).toBe(true);
  });

  it('異なるスキルはfalseになる', () => {
    expect(isSameSkill('Java', 'JavaScript')).toBe(false);
  });
});
