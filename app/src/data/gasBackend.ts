import { BackendError, type Backend, type Invite, type PullResult, type PushResult } from './backend';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  message?: string;
  code?: string;
}

/** Talks to the GAS Web App. Sends text/plain so the browser skips the CORS preflight GAS cannot answer. */
export function createGasBackend(url: string, getIdToken: () => string | null): Backend {
  async function rpc<T>(fn: string, args: unknown[] = []): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn, args, idToken: getIdToken() }),
        redirect: 'follow',
      });
    } catch {
      throw new BackendError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'NETWORK');
    }
    let body: Envelope<T>;
    try {
      body = (await res.json()) as Envelope<T>;
    } catch {
      throw new BackendError('เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ', 'SERVER');
    }
    if (!body.ok) throw new BackendError(body.message ?? 'เกิดข้อผิดพลาด', body.code === 'AUTH' ? 'AUTH' : 'SERVER');
    return body.data as T;
  }

  return {
    pull: (since) => rpc<PullResult>('pull', [since]),
    push: (changes) => rpc<PushResult>('push', [changes]),
    createInvite: (walletId) => rpc<Invite>('createInvite', [walletId]),
    acceptInvite: (code) => rpc<{ walletId: string }>('acceptInvite', [code]),
    leaveWallet: (walletId) => rpc<void>('leaveWallet', [walletId]),
    removeMember: (walletId, email) => rpc<void>('removeMember', [walletId, email]),
  };
}
