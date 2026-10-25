import { createContext, useContext, useMemo } from 'react';
import { summarize } from '../domain/budget';
import { todayKey } from '../domain/cycle';
import type { Backend } from '../data/backend';
import type { Session } from '../data/auth';
import { live, useLocalState } from '../data/store';

export interface AppServices {
  session: Session;
  backend: Backend;
  syncNow: () => Promise<void>;
  signOut: () => void;
}

export const AppContext = createContext<AppServices | null>(null);

export function useApp(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('useApp outside AppContext');
  return services;
}

/** Live (not deleted) rows, sorted for display, plus the budget summary for today. */
export function useData() {
  const state = useLocalState();
  return useMemo(() => {
    const wallets = live(state.wallets).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    const transactions = live(state.transactions).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const categories = live(state.categories).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    const jars = live(state.jars);
    const summary = state.settings
      ? summarize({ wallets, transactions, categories, jars, settings: state.settings, today: todayKey() })
      : null;
    const nameOf = (email: string) => (email === state.email ? 'ฉัน' : (state.people[email] ?? email));
    return { state, wallets, transactions, categories, jars, summary, nameOf };
  }, [state]);
}
