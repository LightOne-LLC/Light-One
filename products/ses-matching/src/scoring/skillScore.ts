import { normalizeSkillName } from './normalize';
import { EngineerSkill, RequiredSkill } from './types';

/**
 * スキル一致スコアを算出する。
 *
 * 考え方:
 *  - 必須スキル(required=true)の充足率をベーススコアとする。
 *    「充足」は (1) スキル名が一致 かつ (2) 要員の経験年数が要件の最低年数以上
 *    であることを指す。
 *  - 尚可スキル(required=false)は加点要素として、充足したスキル1つにつき
 *    少量のボーナスを与える（必須が全て揃っている前提を超えて1.0を超えないようcapする）。
 *  - 必須スキルが1件も定義されていない案件は、尚可スキルの充足率のみで判定する。
 *
 * 戻り値は 0.0 〜 1.0。
 */
export function calcSkillScore(requiredSkills: RequiredSkill[], engineerSkills: EngineerSkill[]): number {
  const engineerSkillMap = new Map<string, number>();
  for (const s of engineerSkills) {
    const key = normalizeSkillName(s.name);
    const existingYears = engineerSkillMap.get(key) ?? 0;
    engineerSkillMap.set(key, Math.max(existingYears, s.years));
  }

  const mustHave = requiredSkills.filter((s) => s.required);
  const niceToHave = requiredSkills.filter((s) => !s.required);

  const isFulfilled = (skill: RequiredSkill): boolean => {
    const years = engineerSkillMap.get(normalizeSkillName(skill.name));
    return years !== undefined && years >= skill.minYears;
  };

  if (mustHave.length === 0 && niceToHave.length === 0) {
    // 必要スキルが未設定の案件は判定不能のため中立スコアとする
    return 0.5;
  }

  if (mustHave.length === 0) {
    const fulfilledCount = niceToHave.filter(isFulfilled).length;
    return fulfilledCount / niceToHave.length;
  }

  const fulfilledMustHave = mustHave.filter(isFulfilled).length;
  const baseScore = fulfilledMustHave / mustHave.length;

  if (niceToHave.length === 0) {
    return baseScore;
  }

  const fulfilledNiceToHave = niceToHave.filter(isFulfilled).length;
  const bonusPerSkill = (1 - baseScore) / niceToHave.length;
  const bonus = fulfilledNiceToHave * bonusPerSkill * 0.5; // ボーナスは差分の半分までに抑える

  return Math.min(1, baseScore + bonus);
}
