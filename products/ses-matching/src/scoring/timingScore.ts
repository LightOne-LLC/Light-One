import type { DateValue } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NEUTRAL_SCORE = 0.5;

/**
 * 稼働時期一致スコアを算出する。
 *
 * 考え方:
 *  - 要員の稼働可能日が案件の開始日以前(既に稼働可能)であれば満点。
 *  - 稼働可能日が開始日より後の場合、その差分(日数)に応じてスコアを減衰させる。
 *    差分が大きいほどアサインが難しくなるため、30日を超えたあたりから急激に下がる
 *    ような区分的な減衰カーブを採用する(day precision同士の場合、既存の
 *    区分は一切変更しない — regression対象)。
 *
 * DateValueの精度によって以下のように扱う:
 *  - day/day, month/month, day/month, month/day:
 *    どちらもカレンダー上の日付として比較できるため、month precisionは
 *    比較用に月初(1日)へ内部変換した上で、既存のday precisionと同じ
 *    区分減衰カーブへ渡す(月精度で「日」を確定させたと主張するものではなく、
 *    あくまでスコア計算用の内部処理)。
 *  - immediate同士: 双方が「即日」を希望しているため満点。
 *  - immediateと day/month の組み合わせ: 「現在時刻」を基準にしないと
 *    日数差を計算できず、現在時刻依存(非決定的)になってしまうため、
 *    根拠のない優遇/減点をせずneutralを返す。
 *  - unknownが一方にでもあれば、根拠のない0点/満点にはせずneutralを返す
 *    (勝手に候補を消さない/勝手に優遇もしない)。
 *
 * 戻り値は 0.0 〜 1.0。
 */
export function calcTimingScore(projectStartDate: DateValue, engineerAvailableFrom: DateValue): number {
  if (projectStartDate.precision === 'unknown' || engineerAvailableFrom.precision === 'unknown') {
    return NEUTRAL_SCORE;
  }

  const projectIsImmediate = projectStartDate.precision === 'immediate';
  const engineerIsImmediate = engineerAvailableFrom.precision === 'immediate';

  if (projectIsImmediate && engineerIsImmediate) {
    return 1;
  }
  if (projectIsImmediate || engineerIsImmediate) {
    // 「現在時刻」無しには日数差を計算できない組み合わせ。
    return NEUTRAL_SCORE;
  }

  // ここに到達する時点で、両者ともday/monthのいずれか(即日/不明は上で処理済み)。
  const startDate = toComparableDate(projectStartDate);
  const availableFrom = toComparableDate(engineerAvailableFrom);

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

/** day precisionはそのまま、month precisionは比較用に月初(1日)へ変換する。
 * (月精度自体が「1日開始」と確定したわけではない、スコア計算専用の内部処理)。 */
function toComparableDate(date: DateValue): Date {
  if (date.precision === 'day') {
    return parseDate(date.value);
  }
  return parseDate(`${date.value}-01`);
}

function parseDate(value: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid date string: ${value}`);
  }
  return d;
}
