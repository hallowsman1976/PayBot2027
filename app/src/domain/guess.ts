import type { Transaction } from './types';

/** Newest-first list of the user's own expense/income Transactions. */
function myHistory(transactions: Transaction[], email: string): Transaction[] {
  return transactions
    .filter((t) => !t.deleted && t.recorderEmail === email && (t.kind === 'expense' || t.kind === 'income'))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** Category used last time for the same note, else the last category used at all. */
export function guessCategory(transactions: Transaction[], email: string, note: string): string | null {
  const history = myHistory(transactions, email);
  const normalized = note.trim().toLowerCase();
  if (normalized) {
    const same = history.find((t) => t.note.trim().toLowerCase() === normalized && t.categoryId);
    if (same) return same.categoryId;
  }
  return history.find((t) => t.categoryId)?.categoryId ?? null;
}

/** The Wallet the user recorded into most recently. */
export function guessWallet(transactions: Transaction[], email: string, walletIds: string[]): string | null {
  const last = myHistory(transactions, email).find((t) => walletIds.includes(t.walletId));
  return last?.walletId ?? walletIds[0] ?? null;
}
