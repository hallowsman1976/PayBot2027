import type { Category, Jar, Satang, Transaction, TransactionKind, UserSettings, Wallet, WalletType } from '../domain/types';
import { commit, getState } from './store';

const id = () => crypto.randomUUID();
const me = () => getState().email;

export const DEFAULT_CATEGORIES = ['อาหาร', 'เดินทาง', 'ของใช้', 'ที่อยู่อาศัย', 'บันเทิง', 'สุขภาพ', 'ทั่วไป'];
export const GENERAL_CATEGORY = 'ทั่วไป';

export function addWallet(name: string, type: WalletType, openingBalance: Satang): Wallet {
  const wallet: Wallet = {
    id: id(), name, type, openingBalance, ownerEmail: me(), members: [me()], updatedAt: '', deleted: false,
  };
  commit({ table: 'wallets', row: wallet });
  return wallet;
}

export function updateWallet(wallet: Wallet, patch: Partial<Pick<Wallet, 'name' | 'type' | 'openingBalance' | 'deleted'>>) {
  commit({ table: 'wallets', row: { ...wallet, ...patch } });
}

export interface TransactionDraft {
  walletId: string;
  kind: TransactionKind;
  amount: Satang;
  toWalletId: string | null;
  categoryId: string | null;
  note: string;
  occurredAt: string;
}

export function saveTransaction(draft: TransactionDraft, existing?: Transaction): Transaction {
  const row: Transaction = {
    id: existing?.id ?? id(),
    recorderEmail: existing?.recorderEmail ?? me(),
    updatedAt: '',
    deleted: false,
    ...draft,
    toWalletId: draft.kind === 'transfer' ? draft.toWalletId : null,
    categoryId: draft.kind === 'expense' || draft.kind === 'income' ? draft.categoryId : null,
  };
  commit({ table: 'transactions', row });
  return row;
}

export function deleteTransaction(t: Transaction) {
  commit({ table: 'transactions', row: { ...t, deleted: true } });
}

export function adjustBalance(walletId: string, delta: Satang) {
  if (delta === 0) return;
  saveTransaction({
    walletId, kind: 'adjustment', amount: delta, toWalletId: null, categoryId: null,
    note: 'ปรับยอด', occurredAt: new Date().toISOString(),
  });
}

export function addCategory(name: string): Category {
  const category: Category = { id: id(), name, updatedAt: '', deleted: false };
  commit({ table: 'categories', row: category });
  return category;
}

/** Sets this user's Jar for a Category; an amount of 0 removes it. */
export function setJar(categoryId: string, amount: Satang) {
  const existing = Object.values(getState().jars).find((j) => j.categoryId === categoryId && j.ownerEmail === me());
  if (!existing && amount === 0) return;
  const jar: Jar = existing
    ? { ...existing, amount, deleted: amount === 0 }
    : { id: id(), ownerEmail: me(), categoryId, amount, updatedAt: '', deleted: false };
  commit({ table: 'jars', row: jar });
}

export function saveSettings(settings: UserSettings) {
  commit({ table: 'settings', row: settings });
}

/** First run: one question ("เดือนละใช้ได้เท่าไร") becomes a "ทั่วไป" Jar, plus a cash Wallet and the household Categories if none exist. */
export function completeOnboarding(displayName: string, monthlyBudget: Satang) {
  const state = getState();
  const existing = Object.values(state.categories).filter((c) => !c.deleted);
  const created = existing.length === 0 ? DEFAULT_CATEGORIES.map(addCategory) : [];
  const general = [...existing, ...created].find((c) => c.name === GENERAL_CATEGORY) ?? addCategory(GENERAL_CATEGORY);

  saveSettings({ email: me(), displayName, cycleStartDay: 1, excludedWalletIds: [], updatedAt: '' });
  if (Object.values(state.wallets).every((w) => w.deleted || w.ownerEmail !== me())) addWallet('เงินสด', 'cash', 0);
  setJar(general.id, monthlyBudget);
}
