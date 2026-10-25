import type { Category, Change, Jar, Transaction, UserSettings, Wallet } from '../domain/types';
import { BackendError, rowId, type Backend, type Invite, type PullResult, type PushResult, type Rejection } from './backend';

/**
 * In-browser stand-in for the GAS backend, used when no VITE_GAS_URL is set.
 * Every signed-in email on this browser shares one "server", so sharing can be tried by signing in as two people.
 * Its permission rules mirror gas/Sync.js and gas/Sharing.js.
 */

interface ServerDb {
  wallets: Wallet[];
  transactions: Transaction[];
  categories: Category[];
  jars: Jar[];
  settings: UserSettings[];
  invites: { code: string; walletId: string; createdBy: string; expiresAt: string; usedBy: string | null }[];
}

const KEY = 'meetung.mockServer';
const INVITE_DAYS = 7;

function load(): ServerDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ServerDb;
  } catch {
    // fall through to an empty server
  }
  return { wallets: [], transactions: [], categories: [], jars: [], settings: [], invites: [] };
}

function save(db: ServerDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // storage unavailable: the mock simply forgets
  }
}

const now = () => new Date().toISOString();
const delay = () => new Promise((r) => setTimeout(r, 150));

function upsert<T>(rows: T[], row: T, idOf: (r: T) => string) {
  const i = rows.findIndex((r) => idOf(r) === idOf(row));
  if (i >= 0) rows[i] = row;
  else rows.push(row);
}

const isMember = (db: ServerDb, walletId: string | null, email: string) =>
  !!walletId && db.wallets.some((w) => w.id === walletId && !w.deleted && w.members.includes(email));

function check(db: ServerDb, email: string, change: Change, stamp: string): string | null {
  switch (change.table) {
    case 'wallets': {
      const existing = db.wallets.find((w) => w.id === change.row.id);
      if (existing && existing.ownerEmail !== email) return 'แก้ไขกระเป๋าได้เฉพาะเจ้าของ';
      const members = existing ? existing.members : [email];
      upsert(db.wallets, { ...change.row, ownerEmail: existing?.ownerEmail ?? email, members, updatedAt: stamp }, (w) => w.id);
      return null;
    }
    case 'transactions': {
      const row = change.row;
      const existing = db.transactions.find((t) => t.id === row.id);
      if (existing && existing.recorderEmail !== email) return 'แก้ไขได้เฉพาะรายการที่ตัวเองจด';
      if (!isMember(db, row.walletId, email)) return 'คุณไม่ได้เป็นสมาชิกของกระเป๋านี้';
      if (row.kind === 'transfer' && !isMember(db, row.toWalletId, email)) return 'คุณไม่ได้เป็นสมาชิกของกระเป๋าปลายทาง';
      upsert(db.transactions, { ...row, recorderEmail: email, updatedAt: stamp }, (t) => t.id);
      return null;
    }
    case 'categories':
      upsert(db.categories, { ...change.row, updatedAt: stamp }, (c) => c.id);
      return null;
    case 'jars': {
      const existing = db.jars.find((j) => j.id === change.row.id);
      if (existing && existing.ownerEmail !== email) return 'แก้ไขได้เฉพาะกระปุกของตัวเอง';
      upsert(db.jars, { ...change.row, ownerEmail: email, updatedAt: stamp }, (j) => j.id);
      return null;
    }
    case 'settings':
      upsert(db.settings, { ...change.row, email, updatedAt: stamp }, (s) => s.email);
      return null;
  }
}

function pull(email: string, since: string | null): PullResult {
  const db = load();
  const serverTime = now();
  const changed = <T extends { updatedAt: string }>(rows: T[]) => rows.filter((r) => since === null || r.updatedAt >= since);
  const accessible = db.wallets.filter((w) => !w.deleted && w.members.includes(email));
  const ids = new Set(accessible.map((w) => w.id));
  const memberEmails = new Set(accessible.flatMap((w) => w.members));
  return {
    serverTime,
    accessibleWalletIds: [...ids],
    wallets: changed(db.wallets.filter((w) => w.members.includes(email))),
    transactions: changed(db.transactions.filter((t) => ids.has(t.walletId) || (t.toWalletId !== null && ids.has(t.toWalletId)))),
    categories: changed(db.categories),
    jars: changed(db.jars.filter((j) => j.ownerEmail === email)),
    settings: db.settings.find((s) => s.email === email) ?? null,
    people: db.settings.filter((s) => memberEmails.has(s.email)).map((s) => ({ email: s.email, displayName: s.displayName })),
  };
}

function push(email: string, changes: Change[]): PushResult {
  const db = load();
  const stamp = now();
  const rejected: Rejection[] = [];
  for (const change of changes) {
    const reason = check(db, email, change, stamp);
    if (reason) rejected.push({ table: change.table, id: rowId(change), reason });
  }
  save(db);
  return { serverTime: stamp, rejected };
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join('');
}

function mutateWallet(walletId: string, fn: (w: Wallet) => string | null) {
  const db = load();
  const wallet = db.wallets.find((w) => w.id === walletId && !w.deleted);
  if (!wallet) throw new BackendError('ไม่พบกระเป๋านี้', 'SERVER');
  const error = fn(wallet);
  if (error) throw new BackendError(error, 'SERVER');
  wallet.updatedAt = now();
  save(db);
}

export function createMockBackend(email: string): Backend {
  return {
    async pull(since) {
      await delay();
      return pull(email, since);
    },
    async push(changes) {
      await delay();
      return push(email, changes);
    },
    async createInvite(walletId): Promise<Invite> {
      await delay();
      const db = load();
      const wallet = db.wallets.find((w) => w.id === walletId && !w.deleted);
      if (!wallet || wallet.ownerEmail !== email) throw new BackendError('เชิญได้เฉพาะเจ้าของกระเป๋า', 'SERVER');
      const invite = {
        code: randomCode(),
        walletId,
        createdBy: email,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
        usedBy: null,
      };
      db.invites.push(invite);
      save(db);
      return { code: invite.code, expiresAt: invite.expiresAt };
    },
    async acceptInvite(code) {
      await delay();
      const db = load();
      const invite = db.invites.find((i) => i.code === code.trim().toUpperCase());
      if (!invite || invite.usedBy || invite.expiresAt < now()) throw new BackendError('รหัสเชิญไม่ถูกต้องหรือหมดอายุแล้ว', 'SERVER');
      invite.usedBy = email;
      save(db);
      mutateWallet(invite.walletId, (w) => {
        if (!w.members.includes(email)) w.members.push(email);
        return null;
      });
      return { walletId: invite.walletId };
    },
    async leaveWallet(walletId) {
      await delay();
      mutateWallet(walletId, (w) => {
        if (w.ownerEmail === email) return 'เจ้าของออกจากกระเป๋าไม่ได้ ให้ลบกระเป๋าแทน';
        w.members = w.members.filter((m) => m !== email);
        return null;
      });
    },
    async removeMember(walletId, member) {
      await delay();
      mutateWallet(walletId, (w) => {
        if (w.ownerEmail !== email) return 'เอาสมาชิกออกได้เฉพาะเจ้าของ';
        if (member === email) return 'เจ้าของเอาตัวเองออกไม่ได้';
        w.members = w.members.filter((m) => m !== member);
        return null;
      });
    },
  };
}
