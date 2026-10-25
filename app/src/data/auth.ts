/**
 * Sign-in. With VITE_GOOGLE_CLIENT_ID set it uses Google Identity Services and keeps the ID token
 * for the GAS backend to verify; without it, a development sign-in that accepts any email.
 */

export interface Session {
  email: string;
  displayName: string;
  idToken: string | null;
}

const KEY = 'meetung.session';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const googleClientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const gasUrl: string = import.meta.env.VITE_GAS_URL ?? '';
export const usesGoogle = googleClientId !== '' && gasUrl !== '';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    const session = raw ? (JSON.parse(raw) as Session) : null;
    // A development sign-in has no token for GAS to verify.
    if (session && usesGoogle && !session.idToken) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // session only lives in memory then
  }
}

export function devSession(email: string, displayName: string): Session {
  return { email: email.trim().toLowerCase(), displayName: displayName.trim() || email, idToken: null };
}

function decodeJwt(token: string): { email: string; name?: string } {
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    Array.from(atob(payload), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
  );
  return JSON.parse(json);
}

interface GoogleId {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let gisReady: Promise<GoogleId> | null = null;

function loadGis(): Promise<GoogleId> {
  gisReady ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('GIS missing')));
    script.onerror = () => reject(new Error('โหลด Google Sign-In ไม่ได้'));
    document.head.appendChild(script);
  });
  return gisReady;
}

// GIS must be initialized once per page and allows one One Tap prompt at a time.
let initialized = false;
let prompting = false;
let currentOnSession: ((s: Session) => void) | null = null;

/** Shows the Google button in `el`; `onSession` fires on every fresh credential, including silent re-sign-ins. */
export async function startGoogleSignIn(el: HTMLElement | null, onSession: (s: Session) => void) {
  const gis = await loadGis();
  currentOnSession = onSession;
  if (!initialized) {
    initialized = true;
    gis.initialize({
      client_id: googleClientId,
      auto_select: true,
      callback: ({ credential }) => {
        prompting = false;
        const claims = decodeJwt(credential);
        currentOnSession?.({ email: claims.email.toLowerCase(), displayName: claims.name ?? claims.email, idToken: credential });
      },
    });
  }
  if (el) gis.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'th' });
  if (prompting) return;
  prompting = true;
  // FedCM deprecates the prompt status callbacks, so allow a new prompt after a pause instead.
  setTimeout(() => (prompting = false), 10_000);
  gis.prompt();
}

export async function signOutGoogle() {
  if (!usesGoogle) return;
  (await loadGis()).disableAutoSelect();
}
