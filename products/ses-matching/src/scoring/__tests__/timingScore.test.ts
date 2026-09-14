import { calcTimingScore } from '../timingScore';
import type { DateValue } from '../types';

function day(value: string): DateValue {
  return { precision: 'day', value };
}

function month(value: string): DateValue {
  return { precision: 'month', value };
}

const immediate: DateValue = { precision: 'immediate', value: '' };
const unknown: DateValue = { precision: 'unknown', value: '' };

describe('calcTimingScore (day precision — 既存挙動のregression)', () => {
  it('稼働可能日が開始日と同日なら満点', () => {
    expect(calcTimingScore(day('2026-01-01'), day('2026-01-01'))).toBe(1);
  });

  it('稼働可能日が開始日より前なら満点', () => {
    expect(calcTimingScore(day('2026-01-15'), day('2026-01-01'))).toBe(1);
  });

  it('7日以内の遅れは0.9', () => {
    expect(calcTimingScore(day('2026-01-01'), day('2026-01-05'))).toBe(0.9);
  });

  it('30日を超える遅れはスコアが大きく下がる', () => {
    expect(calcTimingScore(day('2026-01-01'), day('2026-03-01'))).toBeLessThanOrEqual(0.25);
  });

  it('60日を超える遅れは0点', () => {
    expect(calcTimingScore(day('2026-01-01'), day('2026-12-01'))).toBe(0);
  });

  it('不正な日付文字列はエラーを投げる', () => {
    expect(() => calcTimingScore(day('not-a-date'), day('2026-01-01'))).toThrow();
  });
});

describe('calcTimingScore (month precision)', () => {
  it('同月開始なら満点(month/month)', () => {
    expect(calcTimingScore(month('2026-10'), month('2026-10'))).toBe(1);
  });

  it('要員側の月が案件側より前なら満点(month/month)', () => {
    expect(calcTimingScore(month('2026-10'), month('2026-09'))).toBe(1);
  });

  it('1か月差は既存のday precisionの30日区分相当のスコアになる', () => {
    // 2026-10-01 -> 2026-11-01は31日差で、既存day precisionの
    // "30日を超える"区分(0.25)に相当する。month精度を月初へ内部変換して
    // 既存の区分減衰カーブへそのまま乗せるため、この一致は意図した挙動。
    expect(calcTimingScore(month('2026-10'), month('2026-11'))).toBe(0.25);
  });
});

describe('calcTimingScore (day/monthの混在)', () => {
  it('案件がday、要員がmonthでも既存の区分減衰カーブで計算する', () => {
    // 案件開始日2026-01-01、要員の稼働可能月2026-01(内部的に2026-01-01扱い)
    // -> 同日相当で満点。
    expect(calcTimingScore(day('2026-01-01'), month('2026-01'))).toBe(1);
  });

  it('案件がmonth、要員がdayでも既存の区分減衰カーブで計算する', () => {
    expect(calcTimingScore(month('2026-01'), day('2026-01-05'))).toBe(0.9);
  });
});

describe('calcTimingScore (immediate — 即日)', () => {
  it('双方が即日なら満点', () => {
    expect(calcTimingScore(immediate, immediate)).toBe(1);
  });

  it('案件が即日・要員がday精度の組み合わせは現在時刻に依存させずneutralを返す', () => {
    expect(calcTimingScore(immediate, day('2026-06-01'))).toBe(0.5);
  });

  it('案件がday精度・要員が即日の組み合わせも同様にneutralを返す', () => {
    expect(calcTimingScore(day('2026-06-01'), immediate)).toBe(0.5);
  });
});

describe('calcTimingScore (unknown)', () => {
  it('案件側がunknownならneutral(0.5)を返す(0点にも満点にもしない)', () => {
    expect(calcTimingScore(unknown, day('2026-01-01'))).toBe(0.5);
  });

  it('要員側がunknownならneutral(0.5)を返す', () => {
    expect(calcTimingScore(day('2026-01-01'), unknown)).toBe(0.5);
  });

  it('双方unknownでもneutral(0.5)を返す', () => {
    expect(calcTimingScore(unknown, unknown)).toBe(0.5);
  });

  it('unknownとimmediateの組み合わせもneutral(0.5)を返す', () => {
    expect(calcTimingScore(unknown, immediate)).toBe(0.5);
  });
});
