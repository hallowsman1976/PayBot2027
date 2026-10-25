import type { Satang, Transaction, Wallet } from './types';

/** Current balance of a Wallet. For a credit card a negative balance is the debt. */
export function walletBalance(wallet: Wallet, transactions: Transaction[]): Satang {
  let balance = wallet.openingBalance;
  for (const t of transactions) {
    if (t.deleted) continue;
    if (t.walletId === wallet.id) {
      if (t.kind === 'income' || t.kind === 'adjustment') balance += t.amount;
      else balance -= t.amount; // expense, or transfer out
    } else if (t.kind === 'transfer' && t.toWalletId === wallet.id) {
      balance += t.amount;
    }
  }
  return balance;
}

/** The Adjustment amount that brings a Wallet's balance to what the bank actually shows. */
export const adjustmentFor = (currentBalance: Satang, actualBalance: Satang): Satang => actualBalance - currentBalance;
