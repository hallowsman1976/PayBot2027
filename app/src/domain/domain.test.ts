import { describe, expect, it } from 'vitest';
import { walletBalance } from './balance';
import { summarize } from './budget';
import { cycleContaining, daysLeftInCycle } from './cycle';
import { evaluate, pressKey, type KeypadKey } from './keypad';
import { formatBaht, parseBaht } from './money';
import type { Jar, Transaction, UserSettings, Wallet } from './types';

const type = (keys: string) => [...keys].reduce((expr, k) => pressKey(expr, k as KeypadKey), '');

describe('money', () => {
  it('parses and formats baht as satang', () => {
    expect(parseBaht('1,234.5')).toBe(123450);
    expect(parseBaht('65')).toBe(6500);
    expect(parseBaht('1.234')).toBeNull();
    expect(formatBaht(120000)).toBe('1,200');
    expect(formatBaht(123450)).toBe('1,234.50');
  });
});

describe('keypad', () => {
  it('adds and subtracts', () => {
    expect(evaluate(type('120+45'))).toBe(16500);
    expect(evaluate(type('100-25.5'))).toBe(7450);
  });

  it('ignores a trailing operator and invalid presses', () => {
    expect(type('+12')).toBe('12');
    expect(type('12+-3')).toBe('12-3');
    expect(type('1.234')).toBe('1.23');
    expect(type('1..5')).toBe('1.5');
    expect(type('007')).toBe('7');
    expect(evaluate('12+')).toBe(1200);
    expect(evaluate('')).toBeNull();
  });
});

describe('cycle', () => {
  it('uses calendar months by default', () => {
    expect(cycleContaining('2026-10-25', 1)).toEqual({ start: '2026-10-01', end: '2026-11-01' });
  });

  it('starts on payday and wraps the year', () => {
    expect(cycleContaining('2026-12-26', 25)).toEqual({ start: '2026-12-25', end: '2027-01-25' });
    expect(cycleContaining('2027-01-03', 25)).toEqual({ start: '2026-12-25', end: '2027-01-25' });
  });

  it('clamps a start day past the end of a short month', () => {
    expect(cycleContaining('2026-02-28', 31)).toEqual({ start: '2026-02-28', end: '2026-03-31' });
  });

  it('counts today in the days left', () => {
    expect(daysLeftInCycle('2026-10-31', { start: '2026-10-01', end: '2026-11-01' })).toBe(1);
    expect(daysLeftInCycle('2026-10-25', { start: '2026-10-01', end: '2026-11-01' })).toBe(7);
  });
});

const me = 'me@example.com';
const partner = 'partner@example.com';

const wallet = (id: string, members = [me], extra: Partial<Wallet> = {}): Wallet => ({
  id, name: id, type: 'bank', openingBalance: 0, ownerEmail: members[0], members, updatedAt: '', deleted: false, ...extra,
});

let seq = 0;
const tx = (walletId: string, kind: Transaction['kind'], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${seq++}`, walletId, kind, amount, toWalletId: null, categoryId: 'food', note: '',
  occurredAt: new Date(2026, 9, 20, 12).toISOString(), recorderEmail: me, updatedAt: '', deleted: false, ...extra,
});

const jar = (categoryId: string, amount: number, ownerEmail = me): Jar => ({
  id: `j-${categoryId}-${ownerEmail}`, ownerEmail, categoryId, amount, updatedAt: '', deleted: false,
});

const settings: UserSettings = { email: me, displayName: 'Me', cycleStartDay: 1, excludedWalletIds: [], updatedAt: '' };

describe('budget summary', () => {
  const base = { categories: [], settings, today: '2026-10-25' };

  it('subtracts every expense in the cycle from the total of my jars', () => {
    const s = summarize({
      ...base,
      wallets: [wallet('cash')],
      jars: [jar('food', 500000), jar('travel', 200000), jar('food', 999999, partner)],
      transactions: [
        tx('cash', 'expense', 10000),
        tx('cash', 'expense', 5000, { categoryId: null }), // not in any jar, still counts
        tx('cash', 'income', 3000000),
        tx('cash', 'adjustment', -2000),
        tx('cash', 'expense', 7000, { occurredAt: new Date(2026, 8, 30, 12).toISOString() }), // previous cycle
      ],
    });
    expect(s.budgetTotal).toBe(700000);
    expect(s.spent).toBe(15000);
    expect(s.income).toBe(3000000);
    expect(s.remaining).toBe(685000);
    expect(s.daysLeft).toBe(7);
    expect(s.dailyAllowance).toBe(97800);
  });

  it('counts a partner expense in a shared wallet unless I excluded that wallet', () => {
    const wallets = [wallet('shared', [partner, me])];
    const transactions = [tx('shared', 'expense', 30000, { recorderEmail: partner })];
    const jars = [jar('food', 100000)];

    const counted = summarize({ ...base, wallets, transactions, jars });
    expect(counted.jars[0]).toMatchObject({ spent: 30000, state: 'ok' });

    const excluded = summarize({ ...base, wallets, transactions, jars, settings: { ...settings, excludedWalletIds: ['shared'] } });
    expect(excluded.spent).toBe(0);
  });

  it('marks jars near full and over budget', () => {
    const s = summarize({
      ...base,
      wallets: [wallet('cash')],
      jars: [jar('food', 10000), jar('travel', 10000)],
      transactions: [tx('cash', 'expense', 8500), tx('cash', 'expense', 12000, { categoryId: 'travel' })],
    });
    expect(s.jars.map((j) => j.state)).toEqual(['near', 'over']);
  });

  it('does not count transfers as spending', () => {
    const s = summarize({
      ...base,
      wallets: [wallet('bank'), wallet('card')],
      jars: [jar('food', 10000)],
      transactions: [tx('bank', 'transfer', 50000, { toWalletId: 'card', categoryId: null })],
    });
    expect(s.spent).toBe(0);
  });
});

describe('wallet balance', () => {
  it('applies income, expenses, adjustments and transfers both ways', () => {
    const bank = wallet('bank', [me], { openingBalance: 1200000 });
    const card = wallet('card', [me], { type: 'credit' });
    const ts = [
      tx('bank', 'income', 100000),
      tx('bank', 'expense', 20000),
      tx('bank', 'adjustment', -500),
      tx('card', 'expense', 300000),
      tx('bank', 'transfer', 300000, { toWalletId: 'card' }),
      tx('bank', 'expense', 99999, { deleted: true }),
    ];
    expect(walletBalance(bank, ts)).toBe(979500);
    expect(walletBalance(card, ts)).toBe(0);
  });
});
