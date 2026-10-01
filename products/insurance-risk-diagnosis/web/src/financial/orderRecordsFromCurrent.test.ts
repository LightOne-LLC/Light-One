import { describe, test, expect } from 'vitest';
import { orderRecordsFromCurrent } from './orderRecordsFromCurrent';

// listDiagnosisRecords()と同じく、新しい順(作成日時降順)に並んだ配列を模す。
const RECORDS = [
  { id: 'd', createdAt: '2026-04-01' },
  { id: 'c', createdAt: '2026-03-01' },
  { id: 'b', createdAt: '2026-02-01' },
  { id: 'a', createdAt: '2026-01-01' },
];

describe('orderRecordsFromCurrent', () => {
  test('最新の記録を指定した場合、残り全件が「直前→さらに前」の順で続く', () => {
    const result = orderRecordsFromCurrent(RECORDS, 'd');
    expect(result?.map((r) => r.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  test('最新ではない過去の記録を指定した場合、それより新しい記録は含まれない(時系列の逆転を防ぐ)', () => {
    // 'b'(2026-02-01)を指定した場合、'd'(2026-04-01)や'c'(2026-03-01)という
    // 「bより未来の」記録がhistory[1]として紛れ込んではならない。
    const result = orderRecordsFromCurrent(RECORDS, 'b');
    expect(result?.map((r) => r.id)).toEqual(['b', 'a']);
  });

  test('最も古い記録を指定した場合、自分だけの配列になる(比較対象なし)', () => {
    const result = orderRecordsFromCurrent(RECORDS, 'a');
    expect(result?.map((r) => r.id)).toEqual(['a']);
  });

  test('存在しないidの場合はnullを返す(存在しない記録を捏造しない)', () => {
    expect(orderRecordsFromCurrent(RECORDS, 'nonexistent')).toBeNull();
  });

  test('空配列に対してはnullを返す', () => {
    expect(orderRecordsFromCurrent([], 'a')).toBeNull();
  });

  test('元の配列を変更しない', () => {
    const before = JSON.stringify(RECORDS);
    orderRecordsFromCurrent(RECORDS, 'b');
    expect(JSON.stringify(RECORDS)).toBe(before);
  });
});
