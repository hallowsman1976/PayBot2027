import { useEffect, useRef, useState } from 'react';
import { devSession, startGoogleSignIn, usesGoogle, type Session } from '../data/auth';

export function SignIn({ onSession }: { onSession: (s: Session) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!usesGoogle) return;
    startGoogleSignIn(buttonRef.current, onSession).catch((e: Error) => setError(e.message));
  }, [onSession]);

  return (
    <main className="center-screen">
      <h1 className="brand">MeeTung</h1>
      <p className="muted">จดรายจ่าย แชร์กระเป๋า รู้ว่าเหลือใช้เท่าไร</p>
      {usesGoogle ? (
        <div ref={buttonRef} />
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes('@')) onSession(devSession(email, name));
          }}
        >
          <p className="hint">โหมดทดลอง: ยังไม่ได้ตั้งค่า GAS ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น</p>
          <input type="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input placeholder="ชื่อที่แสดง" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="primary">เข้าใช้งาน</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
