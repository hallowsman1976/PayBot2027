import type { Category, Change, Jar, TableName, Transaction, UserSettings, Wallet } from '../domain/types';

export interface Person {
  email: string;
  displayName: string;
}

export interface PullResult {
  serverTime: string;
  /** Every Wallet the user can still see; anything else held locally must be dropped. */
  accessibleWalletIds: string[];
  wallets: Wallet[];
  transactions: Transaction[];
  categories: Category[];
  jars: Jar[];
  settings: UserSettings | null;
  people: Person[];
}

export interface Rejection {
  table: TableName;
  id: string;
  reason: string;
}

export interface PushResult {
  serverTime: string;
  rejected: Rejection[];
}

export interface Invite {
  code: string;
  expiresAt: string;
}

/** The server as the app sees it. Implemented by the GAS Web App and by an in-browser mock for development. */
export interface Backend {
  /** Rows changed since `since` (server time from the previous pull), or everything when null. */
  pull(since: string | null): Promise<PullResult>;
  push(changes: Change[]): Promise<PushResult>;
  createInvite(walletId: string): Promise<Invite>;
  acceptInvite(code: string): Promise<{ walletId: string }>;
  leaveWallet(walletId: string): Promise<void>;
  removeMember(walletId: string, email: string): Promise<void>;
}

export type BackendErrorCode = 'AUTH' | 'NETWORK' | 'SERVER';

export class BackendError extends Error {
  constructor(
    message: string,
    readonly code: BackendErrorCode,
  ) {
    super(message);
  }
}

export const rowId = (change: Change): string => (change.table === 'settings' ? change.row.email : change.row.id);
