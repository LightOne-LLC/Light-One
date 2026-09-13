const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 稼働時期一致スコアを算出する。
 *
 * 考え方:
 *  - 要員の稼働可能日が案件の開始日以前(既に稼働可能)であれば満点。
 *  - 稼働可能日が開始日より後の場合、その差分(日数)に応じてスコアを減衰させる。
 *    差分が大きいほどアサインが難しくなるため、30日を超えたあたりから急激に下がる
 *    ような区分的な減衰カーブを採用する。
 *
 * 戻り値は 0.0 〜 1.0。
 */
export function calcTimingScore(projectStartDate: string, engineerAvailableFrom: string): number {
  const startDate = parseDate(projectStartDate);
  const availableFrom = parseDate(engineerAvailableFrom);

  const diffDays = Math.round((availableFrom.getTime() - startDate.getTime()) / MS_PER_DAY);

  if (diffDays <= 0) {
    // 開始日までに稼働可能（前倒しで空いている場合も含む）
    return 1;
  }
  if (diffDays <= 7) {
    return 0.9;
  }
  if (diffDays <= 14) {
    return 0.75;
  }
  if (diffDays <= 30) {
    return 0.5;
  }
  if (diffDays <= 60) {
    return 0.25;
  }
  return 0;
}

function parseDate(value: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid date string: ${value}`);
  }
  return d;
}
