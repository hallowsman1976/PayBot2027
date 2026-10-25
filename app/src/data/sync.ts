import { BackendError, type Backend } from './backend';
import { getState, mergePull, setSync, settleOutbox, subscribe } from './store';

const POLL_MS = 30_000;
const DEBOUNCE_MS = 1_000;

/**
 * Keeps the store in step with the server: push the outbox, then pull changes since the last pull.
 * Runs on start, shortly after each local edit, every 30 s while the app is visible, and when the device comes online.
 */
export function startSync(backend: Backend, onAuthExpired: () => void): { syncNow: () => Promise<void>; stop: () => void } {
  let running: Promise<void> | null = null;
  let again = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  async function once() {
    setSync({ status: 'syncing', message: null });
    try {
      const sent = getState().outbox;
      if (sent.length > 0) {
        const result = await backend.push(sent);
        settleOutbox(sent, result.rejected.length > 0);
        if (result.rejected.length > 0) {
          await pullNow();
          setSync({ status: 'error', message: result.rejected.map((r) => r.reason).join(', ') });
          return;
        }
      }
      await pullNow();
      setSync({ status: 'idle', message: null });
    } catch (err) {
      if (err instanceof BackendError && err.code === 'AUTH') {
        setSync({ status: 'error', message: 'ต้องล็อกอินใหม่' });
        onAuthExpired();
      } else if (err instanceof BackendError && err.code === 'NETWORK') {
        setSync({ status: 'offline', message: null });
      } else {
        setSync({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  async function pullNow() {
    mergePull(await backend.pull(getState().lastPulledAt));
  }

  function syncNow(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = once().finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    });
    return running;
  }

  let lastOutbox = getState().outbox;
  const unsubscribe = subscribe(() => {
    const { outbox } = getState();
    if (outbox !== lastOutbox && outbox.length > 0) {
      clearTimeout(debounce);
      debounce = setTimeout(() => void syncNow(), DEBOUNCE_MS);
    }
    lastOutbox = outbox;
  });

  const poll = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, POLL_MS);
  const onWake = () => {
    if (document.visibilityState === 'visible') void syncNow();
  };
  window.addEventListener('online', onWake);
  document.addEventListener('visibilitychange', onWake);

  void syncNow();

  return {
    syncNow,
    stop() {
      unsubscribe();
      clearTimeout(debounce);
      clearInterval(poll);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
    },
  };
}
