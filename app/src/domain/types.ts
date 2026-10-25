/** Money is always stored as integer satang (1 บาท = 100 satang). */
export type Satang = number;

export type WalletType = 'bank' | 'cash' | 'credit';

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  openingBalance: Satang;
  ownerEmail: string;
  members: string[];
  updatedAt: string;
  deleted: boolean;
}

export type TransactionKind = 'expense' | 'income' | 'transfer' | 'adjustment';

export interface Transaction {
  id: string;
  walletId: string;
  kind: TransactionKind;
  /** Positive for expense, income and transfer. Signed for adjustment (the change to the balance). */
  amount: Satang;
  /** Destination wallet; only for transfers. */
  toWalletId: string | null;
  categoryId: string | null;
  note: string;
  occurredAt: string;
  recorderEmail: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Category {
  id: string;
  name: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Jar {
  id: string;
  ownerEmail: string;
  categoryId: string;
  amount: Satang;
  updatedAt: string;
  deleted: boolean;
}

export interface UserSettings {
  email: string;
  displayName: string;
  /** Day of month the Cycle starts on (1–31, clamped to the month's length). */
  cycleStartDay: number;
  /** Wallets this user switched off "นับในงบของฉัน". */
  excludedWalletIds: string[];
  updatedAt: string;
}

export type TableName = 'wallets' | 'transactions' | 'categories' | 'jars' | 'settings';

export type Change =
  | { table: 'wallets'; row: Wallet }
  | { table: 'transactions'; row: Transaction }
  | { table: 'categories'; row: Category }
  | { table: 'jars'; row: Jar }
  | { table: 'settings'; row: UserSettings };
