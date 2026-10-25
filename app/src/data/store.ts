import { useSyncExternalStore } from 'react';
import type { Category, Change, Jar, Transaction, UserSettings, Wallet } from '../domain/types';
import { rowId, type PullResult } from './backend';

/**
 * The device's copy of the data. Every edit lands here first and is queued in the outbox,
 * so recording works offline; sync.ts pushes the outbox and merges pulls back in.
 */
export interface LocalState {
  email: string;
  wallets: Record<string, Wallet>;
  transactions: Record<string, Transaction>;
  categories: Record<string, Category>;
  jars: Record<string, Jar>;
  settings: UserSettings | null;
  people: Record<string, string>;
  outbox: Change[];
  lastPulledAt: string | null;
  /** True once a pull has succeeded at least once on this device. */
  hydrated: boolean;
  sync: { status: 'idle' | 'syncing' | 'offline' | 'error'; message: string | null };
}

const keyFor = (email: string) => `meetung.local.${email}`;

function empty(email: string): LocalState {
  return {
    email,
    wallets: {},
    transactions: {},
    categories: {},
    jars: {},
    settings: null,
    people: {},
    outbox: [],
    lastPulledAt: null,
    hydrated: false,
    sync: { status: 'idle', message: null },
  };
}

let state: LocalState = empty('');
const listeners = new Set<() => void>();

function persist() {
  try {
    const { sync: _sync, ...saved } = state;
    localStorage.setItem(keyFor(state.email), JSON.stringify(saved));
  } catch {
    // keep working from memory
  }
}

function set(next: LocalState, save = true) {
  state = next;
  if (save) persist();
  listeners.forEach((l) => l());
}

export function openStore(email: string) {
  let loaded = empty(email);
  try {
    const raw = localStorage.getItem(keyFor(email));
    if (raw) loaded = { ...loaded, ...JSON.parse(raw), sync: loaded.sync };
  } catch {
    // start empty
  }
  set(loaded, false);
}

export const getState = () => state;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The whole state; derive views with useMemo so selectors never hand React a fresh object per render. */
export function useLocalState(): LocalState {
  return useSyncExternalStore(subscribe, getState);
}

const sameRow = (a: Change, b: Change) => a.table === b.table && rowId(a) === rowId(b);

function applyRow(s: LocalState, change: Change): LocalState {
  switch (change.table) {
    case 'wallets':
      return { ...s, wallets: { ...s.wallets, [change.row.id]: change.row } };
    case 'transactions':
      return { ...s, transactions: { ...s.transactions, [change.row.id]: change.row } };
    case 'categories':
      return { ...s, categories: { ...s.categories, [change.row.id]: change.row } };
    case 'jars':
      return { ...s, jars: { ...s.jars, [change.row.id]: change.row } };
    case 'settings':
      return { ...s, settings: change.row };
  }
}

/** Applies local edits immediately and queues them for the server. */
export function commit(...changes: Change[]) {
  let next = state;
  for (const change of changes) {
    const row = { ...change.row, updatedAt: new Date().toISOString() } as Change['row'];
    const stamped = { table: change.table, row } as Change;
    next = applyRow(next, stamped);
    next = { ...next, outbox: [...next.outbox.filter((c) => !sameRow(c, stamped)), stamped] };
  }
  set(next);
}

export function setSync(sync: LocalState['sync']) {
  set({ ...state, sync }, false);
}

/** Removes outbox entries the server has now seen, unless they were edited again meanwhile. */
export function settleOutbox(sent: Change[], refetchAll: boolean) {
  const outbox = state.outbox.filter((c) => !sent.includes(c));
  set({ ...state, outbox, lastPulledAt: refetchAll ? null : state.lastPulledAt });
}

/** Merges a pull. Rows with an unsent local edit keep the local version. */
export function mergePull(result: PullResult) {
  const pending = (change: Change) => state.outbox.some((c) => sameRow(c, change));
  let next = state;
  const incoming: Change[] = [
    ...result.wallets.map((row) => ({ table: 'wallets', row }) as Change),
    ...result.transactions.map((row) => ({ table: 'transactions', row }) as Change),
    ...result.categories.map((row) => ({ table: 'categories', row }) as Change),
    ...result.jars.map((row) => ({ table: 'jars', row }) as Change),
    ...(result.settings ? [{ table: 'settings', row: result.settings } as Change] : []),
  ];
  for (const change of incoming) if (!pending(change)) next = applyRow(next, change);

  // Drop Wallets the user lost access to, and their Transactions — but keep ones created offline and not yet sent.
  const accessible = new Set(result.accessibleWalletIds);
  const unsentWallets = new Set(next.outbox.filter((c) => c.table === 'wallets').map(rowId));
  const visible = (id: string | null) => id !== null && (accessible.has(id) || unsentWallets.has(id));
  const wallets = Object.fromEntries(Object.entries(next.wallets).filter(([id]) => visible(id)));
  const transactions = Object.fromEntries(
    Object.entries(next.transactions).filter(([, t]) => visible(t.walletId) || visible(t.toWalletId)),
  );

  set({
    ...next,
    wallets,
    transactions,
    people: { ...next.people, ...Object.fromEntries(result.people.map((p) => [p.email, p.displayName])) },
    lastPulledAt: result.serverTime,
    hydrated: true,
  });
}

export function clearLocal(email: string) {
  try {
    localStorage.removeItem(keyFor(email));
  } catch {
    // nothing stored
  }
}

export const live = <T extends { deleted: boolean }>(rows: Record<string, T>): T[] =>
  Object.values(rows).filter((r) => !r.deleted);
