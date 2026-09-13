/**
 * 勤務地/リモート一致スコアを算出する。
 *
 * ルール:
 *  - 案件がフルリモート可(remoteAllowed=true)かつ要員もリモート希望(remoteDesired=true) -> 1.0
 *  - 案件がリモート不可でも、要員の希望勤務地に案件の勤務地が含まれる -> 1.0
 *  - 案件がリモート可だが要員はリモート希望なし、かつ勤務地が一致する -> 1.0
 *    (出社してもよい/希望地なので問題なし)
 *  - 案件がリモート可で要員は出社希望のみだが勤務地が不一致 -> 0.7
 *    (リモートで妥協できる可能性があるため中程度のスコア)
 *  - 案件がリモート不可で要員がリモート希望のみ・勤務地不一致 -> 0.0
 *  - それ以外(双方出社希望で勤務地不一致) -> 0.0
 *
 * 戻り値は 0.0 〜 1.0。
 */
export function calcLocationScore(
  projectLocation: string,
  projectRemoteAllowed: boolean,
  engineerDesiredLocations: string[],
  engineerRemoteDesired: boolean,
): number {
  const normalizedProjectLocation = projectLocation.trim();
  const locationMatches = engineerDesiredLocations
    .map((l) => l.trim())
    .includes(normalizedProjectLocation);

  if (projectRemoteAllowed && engineerRemoteDesired) {
    return 1;
  }
  if (locationMatches) {
    return 1;
  }
  if (projectRemoteAllowed && !engineerRemoteDesired) {
    return 0.7;
  }
  return 0;
}
