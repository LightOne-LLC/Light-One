/**
 * 単価一致スコアを算出する。
 *
 * 考え方:
 *  - 案件の単価レンジ [projectMin, projectMax] と要員希望レンジ
 *    [engineerMin, engineerMax] の重なり(共通区間)の長さを求める。
 *  - 重なりが要員希望レンジに占める割合を基本スコアとする
 *    （要員がその案件でどれだけ希望に近い単価で契約できそうかを見るため）。
 *  - レンジが全く重ならない場合は、両レンジの間のギャップに応じて
 *    0に向けて緩やかに減衰させる（惜しい差は多少加点する）。
 *
 * 戻り値は 0.0 〜 1.0。
 */
export function calcRateScore(
  projectMin: number,
  projectMax: number,
  engineerMin: number,
  engineerMax: number,
): number {
  if (projectMax < projectMin || engineerMax < engineerMin) {
    throw new Error('rate range max must be >= min');
  }

  const overlapStart = Math.max(projectMin, engineerMin);
  const overlapEnd = Math.min(projectMax, engineerMax);

  if (overlapStart <= overlapEnd) {
    const engineerRange = engineerMax - engineerMin;
    const overlapLength = overlapEnd - overlapStart;

    if (engineerRange === 0) {
      // 要員希望が単一値のケース: その値が案件レンジに入っていれば満点
      return 1;
    }
    return overlapLength / engineerRange;
  }

  // 重ならない場合: ギャップが大きいほどスコアを下げる
  const gap = overlapStart - overlapEnd; // 正の値になる
  const referenceScale = Math.max(projectMax, engineerMax, 1);
  const decayed = 1 - gap / referenceScale;
  return Math.max(0, decayed * 0.4); // 重なりなしは最大でも0.4未満に抑える
}
