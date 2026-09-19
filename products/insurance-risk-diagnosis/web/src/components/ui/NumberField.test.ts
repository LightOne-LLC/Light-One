import { describe, test, expect } from 'vitest';
import { formatForDisplay, parseNumberFieldInput, clampNumber } from './NumberField';

// 「数値入力欄の0が消せない」バグの核心ロジックを、実DOM/ブラウザなしで検証する。
describe('NumberField - formatForDisplay(初期表示/外部同期時の表示ルール)', () => {
  test('0は空欄として表示する(初期状態で空欄になる要件)', () => {
    expect(formatForDisplay(0)).toBe('');
  });

  test('0以外の数値はそのまま文字列化して表示する', () => {
    expect(formatForDisplay(500)).toBe('500');
    expect(formatForDisplay(-5)).toBe('-5');
  });
});

describe('NumberField - parseNumberFieldInput(入力中のテキスト→親へ渡す数値)', () => {
  test('空欄は0として扱う(全選択→Delete/Backspaceで空欄にできる)', () => {
    expect(parseNumberFieldInput('')).toBe(0);
  });

  test('マイナス記号のみの入力途中状態も0として扱い、入力を妨げない', () => {
    expect(parseNumberFieldInput('-')).toBe(0);
  });

  test('明示的に入力した0は0として保持される', () => {
    expect(parseNumberFieldInput('0')).toBe(0);
  });

  test('通常の数値はそのままNumberに変換される', () => {
    expect(parseNumberFieldInput('300')).toBe(300);
    expect(parseNumberFieldInput('12.5')).toBe(12.5);
  });

  test('数値化できない入力はnullを返し、更新を保留する(表示は妨げない)', () => {
    expect(parseNumberFieldInput('abc')).toBeNull();
  });
});

describe('NumberField - clampNumber(極端な数値の入力に対する確定時の丸め)', () => {
  test('maxを超える値はmaxに丸められる(例: 年齢に99999999を入力)', () => {
    expect(clampNumber(99999999, 0, 120)).toBe(120);
  });

  test('minを下回る値はminに丸められる(例: 負の年齢)', () => {
    expect(clampNumber(-50, 0, 120)).toBe(0);
  });

  test('範囲内の値はそのまま返す', () => {
    expect(clampNumber(45, 0, 120)).toBe(45);
  });

  test('min/maxが未指定の項目(金額等)はクランプしない', () => {
    expect(clampNumber(999999999999)).toBe(999999999999);
  });

  test('minのみ指定されている場合、maxは無制限', () => {
    expect(clampNumber(999999999999, 0)).toBe(999999999999);
    expect(clampNumber(-1, 0)).toBe(0);
  });
});
