import { useCallback, useEffect, useMemo, useState } from 'react';
import { gasUrl, loadSession, saveSession, signOutGoogle, startGoogleSignIn, usesGoogle, type Session } from '../data/auth';
import type { Backend } from '../data/backend';
import { createGasBackend } from '../data/gasBackend';
import { createMockBackend } from '../data/mockServer';
import { openStore, useLocalState } from '../data/store';
import { startSync } from '../data/sync';
import { AppContext, type AppServices } from './context';
import { Home } from './Home';
import { Jars } from './Jars';
import { Onboarding } from './Onboarding';
import { QuickEntry } from './QuickEntry';
import { SignIn } from './SignIn';
import { Wallets } from './Wallets';

type Tab = 'home' | 'wallets' | 'jars';

export function App() {
  const [session, setSession] = useState<Session | null>(loadSession);

  const onSession = useCallback((s: Session) => {
    saveSession(s);
    setSession(s);
  }, []);

  if (!session) return <SignIn onSession={onSession} />;
  return <SignedIn key={session.email} session={session} onSession={onSession} onSignOut={() => {
    saveSession(null);
    void signOutGoogle();
    setSession(null);
  }} />;
}

function SignedIn({ session, onSession, onSignOut }: { session: Session; onSession: (s: Session) => void; onSignOut: () => void }) {
  const [ready, setReady] = useState(false);
  const [syncNow, setSyncNow] = useState<() => Promise<void>>(() => async () => {});

  // The GAS backend reads the token on every call, so a silent re-sign-in takes effect immediately.
  const backend: Backend = useMemo(
    () => (usesGoogle ? createGasBackend(gasUrl, () => loadSession()?.idToken ?? null) : createMockBackend(session.email)),
    [session.email],
  );

  useEffect(() => {
    openStore(session.email);
    const sync = startSync(backend, () => {
      if (usesGoogle) void startGoogleSignIn(null, onSession);
    });
    setSyncNow(() => sync.syncNow);
    setReady(true);
    return sync.stop;
  }, [backend, session.email, onSession]);

  const services: AppServices = useMemo(
    () => ({ session, backend, syncNow, signOut: onSignOut }),
    [session, backend, syncNow, onSignOut],
  );

  if (!ready) return null;
  return (
    <AppContext.Provider value={services}>
      <Shell />
    </AppContext.Provider>
  );
}

function Shell() {
  const state = useLocalState();
  const [tab, setTab] = useState<Tab>('home');
  const [entering, setEntering] = useState(false);

  // Wait for the first pull before onboarding, so a partner's household Categories are not duplicated.
  const firstPullPending = !state.hydrated && state.sync.status !== 'offline' && state.sync.status !== 'error';
  if (!state.settings) {
    if (firstPullPending) return <main className="center-screen muted">กำลังโหลด…</main>;
    return <Onboarding />;
  }

  return (
    <div className="app">
      {tab === 'home' && <Home />}
      {tab === 'wallets' && <Wallets />}
      {tab === 'jars' && <Jars />}

      <button className="fab" onClick={() => setEntering(true)} aria-label="จดรายการ">
        ＋ จด
      </button>

      <nav className="tabbar">
        {(
          [
            ['home', '🏠', 'หน้าแรก'],
            ['wallets', '👛', 'กระเป๋า'],
            ['jars', '🫙', 'กระปุก'],
          ] as const
        ).map(([key, icon, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {entering && <QuickEntry onClose={() => setEntering(false)} />}
    </div>
  );
}
