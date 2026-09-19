import { useEffect, useRef, useState } from 'react';

// 0を「空欄」として表示するための整形。0(=初期値/未入力)は常に空欄表示にすることで、
// 「消したのにまた0が出る」を防ぎつつ、既存の number 型・計算ロジックは一切変更しない。
export function formatForDisplay(value: number): string {
  return value === 0 ? '' : String(value);
}

// ユーザーが入力した生テキストから、親へ渡す数値を決定する。
// 空欄・入力途中の"-"は0として扱う(既存の「未入力=0」というデータモデルは変えない)。
// 無効な文字列(まだ数値になっていない入力途中の状態)はnullを返し、更新を保留する。
export function parseNumberFieldInput(raw: string): number | null {
  if (raw === '' || raw === '-') return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

// min/maxはネイティブのinput属性としてはブラウザの視覚的ヒントにしかならず、
// onChangeで渡ってくる値そのものは範囲外でも素通りしてしまう(例: 年齢に99999999を
// 入力できてしまう)。診断エンジン(web/src/calc)は変更せず、入力層でのみ範囲外の
// 極端な数値を確定時(blur)にクランプすることで、あり得ない数値が計算に渡るのを防ぐ。
export function clampNumber(value: number, min?: number, max?: number): number {
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal';
  className: string;
}

// 数値入力欄の「0が消せない」問題を修正する。
// 表示中のテキストをローカルで保持し、空欄への編集や0の明示的な入力をそのまま受け付ける。
// 親のvalueには常に有効なnumberを渡す(型・計算ロジックは変更しない)ため、
// 空欄は内部的には0として扱われる。外部要因(下書き復元・リセットボタン等、
// このコンポーネント自身のonChange以外による変更)でのみ表示を同期し直し、
// 0(=未入力扱い)は一貫して空欄表示にすることで「0を消したらまた0に戻る」現象を防ぐ。
export function NumberField({ value, onChange, className, min, max, step, placeholder, inputMode = 'numeric' }: NumberFieldProps) {
  const [text, setText] = useState(() => formatForDisplay(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(formatForDisplay(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const handleChange = (raw: string) => {
    setText(raw);
    const n = parseNumberFieldInput(raw);
    if (n === null) return;
    lastEmitted.current = n;
    onChange(n);
  };

  // 入力中はクランプしない(例: max=120に対して"1"→"12"の途中で弾かれるのを防ぐ)。
  // 入力確定(blur)時にのみ範囲外の値を丸める。
  const handleBlur = () => {
    const n = parseNumberFieldInput(text);
    if (n === null) return;
    const clamped = clampNumber(n, min, max);
    if (clamped !== n) {
      setText(formatForDisplay(clamped));
      lastEmitted.current = clamped;
      onChange(clamped);
    }
  };

  return (
    <input
      type="number"
      inputMode={inputMode}
      className={className}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
    />
  );
}
