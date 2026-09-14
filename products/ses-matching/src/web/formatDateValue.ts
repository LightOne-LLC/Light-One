import type { DateValue } from '../scoring/types';

/** PWA表示用にDateValueを短い日本語表記へ変換する。month precisionを
 * dayであるかのように見せない(例: "2026-10"のまま、日付を捏造しない)。 */
export function formatDateValue(date: DateValue): string {
  switch (date.precision) {
    case 'day':
      return date.value;
    case 'month':
      return `${date.value}(月)`;
    case 'immediate':
      return '即日';
    case 'unknown':
      return '不明';
  }
}
