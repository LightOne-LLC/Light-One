import { normalizeSkillName } from '../../scoring/normalize';
import type { EngineerSkill, RequiredSkill } from '../../scoring/types';

export interface SkillFulfillmentItem {
  name: string;
  required: boolean;
  fulfilled: boolean;
}

/**
 * 案件のrequiredSkillsそれぞれについて、要員がそのスキルを充足しているかを
 * Quick Matchの候補カード表示用に判定する(「◎ ILE-RPG」「△ 仕訳関連知識」
 * のような1スキルごとの表示に使う)。
 *
 * 既存のcalcSkillScore()(src/scoring/skillScore.ts)内部の充足判定
 * (normalizeSkillNameで比較し、経験年数が最低年数以上か)と同じ考え方を
 * 表示専用にここへ複製している。calcSkillScore自体は変更せず、スコアの
 * 意味・計算方法には一切影響しない(この関数の戻り値はUI表示にのみ使い、
 * スコア計算へはフィードバックしない)。
 */
export function getSkillFulfillment(
  requiredSkills: RequiredSkill[],
  engineerSkills: EngineerSkill[],
): SkillFulfillmentItem[] {
  const engineerSkillMap = new Map<string, number>();
  for (const skill of engineerSkills) {
    const key = normalizeSkillName(skill.name);
    const existingYears = engineerSkillMap.get(key) ?? 0;
    engineerSkillMap.set(key, Math.max(existingYears, skill.years));
  }

  return requiredSkills.map((skill) => {
    const years = engineerSkillMap.get(normalizeSkillName(skill.name));
    return {
      name: skill.name,
      required: skill.required,
      fulfilled: years !== undefined && years >= skill.minYears,
    };
  });
}

/** スコア(0-1)を◎/○/△の3段階表示に変換する(表示専用の閾値であり、
 * スコアの計算・重み付けには一切影響しない)。 */
export function scoreToIndicator(score: number): '◎' | '○' | '△' {
  if (score >= 0.8) return '◎';
  if (score >= 0.5) return '○';
  return '△';
}
