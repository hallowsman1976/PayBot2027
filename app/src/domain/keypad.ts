import { parseBaht } from './money';
import type { Satang } from './types';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '+' | '-' | 'back' | 'clear';

const isOperator = (c: string) => c === '+' || c === '-';

/** Applies one key press to the keypad expression, ignoring presses that would make it invalid. */
export function pressKey(expr: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'back') return expr.slice(0, -1);

  const last = expr.at(-1) ?? '';
  const currentNumber = expr.split(/[+-]/).at(-1) ?? '';

  if (isOperator(key)) {
    if (expr === '') return expr;
    if (isOperator(last)) return expr.slice(0, -1) + key;
    if (last === '.') return expr.slice(0, -1) + key;
    return expr + key;
  }
  if (key === '.') {
    if (currentNumber.includes('.')) return expr;
    return expr + (currentNumber === '' ? '0.' : '.');
  }
  // digit
  const [int, frac] = currentNumber.split('.');
  if (frac !== undefined && frac.length >= 2) return expr;
  if (frac === undefined && int.length >= 9) return expr;
  if (currentNumber === '0') return expr.slice(0, -1) + key;
  return expr + key;
}

/** Evaluates "120+45-5" → 16000 satang. A trailing operator is ignored. Null if empty or invalid. */
export function evaluate(expr: string): Satang | null {
  const trimmed = expr.replace(/[+-]$/, '');
  if (trimmed === '') return null;
  const parts = trimmed.match(/[+-]?[^+-]+/g);
  if (!parts) return null;
  let total = 0;
  for (const part of parts) {
    const sign = part.startsWith('-') ? -1 : 1;
    const value = parseBaht(part.replace(/^[+-]/, ''));
    if (value === null) return null;
    total += sign * value;
  }
  return total;
}

export const hasOperator = (expr: string) => /\d[+-]\d/.test(expr);
