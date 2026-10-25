import { cycleContaining, dayKeyOf, daysLeftInCycle, inCycle, type Cycle, type DayKey } from './cycle';
import type { Category, Jar, Satang, Transaction, UserSettings, Wallet } from './types';

/** Wallets whose expenses count against this user's Jars: ones they are a Member of and have not excluded. */
export function countedWalletIds(wallets: Wallet[], settings: UserSettings): Set<string> {
  return new Set(
    wallets
      .filter((w) => !w.deleted && w.members.includes(settings.email) && !settings.excludedWalletIds.includes(w.id))
      .map((w) => w.id),
  );
}

export interface JarStatus {
  jar: Jar;
  category: Category | undefined;
  spent: Satang;
  /** spent ÷ jar amount; above 1 means over budget. */
  ratio: number;
  state: 'ok' | 'near' | 'over';
}

export interface BudgetSummary {
  cycle: Cycle;
  budgetTotal: Satang;
  spent: Satang;
  income: Satang;
  remaining: Satang;
  daysLeft: number;
  dailyAllowance: Satang;
  jars: JarStatus[];
}

const NEAR_FULL = 0.8;

export function summarize(input: {
  wallets: Wallet[];
  transactions: Transaction[];
  categories: Category[];
  jars: Jar[];
  settings: UserSettings;
  today: DayKey;
}): BudgetSummary {
  const { settings, today } = input;
  const cycle = cycleContaining(today, settings.cycleStartDay);
  const counted = countedWalletIds(input.wallets, settings);
  const inThisCycle = input.transactions.filter(
    (t) => !t.deleted && counted.has(t.walletId) && inCycle(dayKeyOf(t.occurredAt), cycle),
  );
  const sum = (ts: Transaction[]) => ts.reduce((acc, t) => acc + t.amount, 0);

  const expenses = inThisCycle.filter((t) => t.kind === 'expense');
  const spent = sum(expenses);
  const income = sum(inThisCycle.filter((t) => t.kind === 'income'));

  const myJars = input.jars.filter((j) => !j.deleted && j.ownerEmail === settings.email);
  const budgetTotal = myJars.reduce((acc, j) => acc + j.amount, 0);
  const remaining = budgetTotal - spent;
  const daysLeft = daysLeftInCycle(today, cycle);

  const jars = myJars.map((jar): JarStatus => {
    const jarSpent = sum(expenses.filter((t) => t.categoryId === jar.categoryId));
    const ratio = jar.amount > 0 ? jarSpent / jar.amount : jarSpent > 0 ? Infinity : 0;
    return {
      jar,
      category: input.categories.find((c) => c.id === jar.categoryId),
      spent: jarSpent,
      ratio,
      state: ratio > 1 ? 'over' : ratio >= NEAR_FULL ? 'near' : 'ok',
    };
  });

  return {
    cycle,
    budgetTotal,
    spent,
    income,
    remaining,
    daysLeft,
    // Whole baht, rounded down, so spending the allowance every day never overshoots.
    dailyAllowance: remaining > 0 ? Math.floor(remaining / daysLeft / 100) * 100 : 0,
    jars,
  };
}
