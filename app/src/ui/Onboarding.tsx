import { useState } from 'react';
import { completeOnboarding } from '../data/actions';
import { parseBaht } from '../domain/money';
import { useApp } from './context';

export function Onboarding() {
  const { session } = useApp();
  const [amount, setAmount] = useState('');
  const [name, setName] = useState(session.displayName);
  const budget = parseBaht(amount);

  return (
    <main className="center-screen">
      <h1>เดือนละใช้ได้เท่าไร?</h1>
      <p className="muted">ใส่ไว้ก่อนหนึ่งยอด แล้วค่อยแบ่งเป็นกระปุกตามหมวดทีหลังได้</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (budget) completeOnboarding(name.trim() || session.email, budget);
        }}
      >
        <input
          className="big-input"
          inputMode="decimal"
          placeholder="เช่น 15,000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <input placeholder="ชื่อที่แสดงให้สมาชิกเห็น" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" disabled={!budget}>
          เริ่มใช้
        </button>
      </form>
    </main>
  );
}
