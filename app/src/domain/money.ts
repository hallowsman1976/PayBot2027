import type { Satang } from './types';

const whole = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const withSatang = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123450 → "1,234.50", 120000 → "1,200" */
export function formatBaht(amount: Satang): string {
  const fmt = amount % 100 === 0 ? whole : withSatang;
  return fmt.format(amount / 100);
}

/** Parses "1,234.5" → 123450. Returns null for anything that is not a plain non-negative amount. */
export function parseBaht(text: string): Satang | null {
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text.replace(/,/g, '').trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}
