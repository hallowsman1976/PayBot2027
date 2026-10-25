import { useState } from 'react';
import type { Transaction } from '../domain/types';
import { Bar, Money, formatDay, formatDayKey } from './common';
import { useData } from './context';
import { QuickEntry } from './QuickEntry';

const KIND_SIGN: Record<Transaction['kind'], number> = { expense: -1, income: 1, transfer: 0, adjustment: 1 };

/** The last day of the Cycle, for display (Cycle.end is exclusive). */
function lastDay(end: string): string {
  const [y, m, d] = end.split('-').map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function Home() {
  const { state, summary, transactions, wallets, categories, nameOf } = useData();
  const [editing, setEditing] = useState<Transaction | null>(null);
  if (!summary) return null;

  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name ?? 'กระเป๋าอื่น';
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const recent = transactions.slice(0, 30);

  return (
    <div className="screen">
      <section className="hero">
        <div className="hero-label">
          เหลือใช้รอบนี้ · {formatDayKey(summary.cycle.start)} – {formatDayKey(lastDay(summary.cycle.end))}
        </div>
        <div className={`hero-amount ${summary.remaining < 0 ? 'negative' : ''}`}>
          <Money amount={summary.remaining} />
        </div>
        <div className="hero-daily">
          ตกวันละ <strong><Money amount={summary.dailyAllowance} /></strong> · อีก {summary.daysLeft} วัน
        </div>
        <div className="hero-small">
          <span>รับ <Money amount={summary.income} /></span>
          <span>จ่าย <Money amount={summary.spent} /></span>
          <span>งบ <Money amount={summary.budgetTotal} /></span>
        </div>
      </section>

      <section>
        <h2 className="section-title">กระปุก</h2>
        <ul className="jar-list">
          {[...summary.jars]
            .sort((a, b) => b.ratio - a.ratio)
            .map((j) => (
              <li key={j.jar.id} className="jar">
                <div className="jar-head">
                  <span>{j.category?.name ?? 'หมวดที่ถูกลบ'}</span>
                  <span className={`jar-left ${j.state}`}>
                    {j.state === 'over' ? 'เกิน ' : 'เหลือ '}
                    <Money amount={Math.abs(j.jar.amount - j.spent)} />
                  </span>
                </div>
                <Bar ratio={j.ratio} state={j.state} />
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="section-title">รายการล่าสุด</h2>
        {recent.length === 0 && <p className="muted">ยังไม่มีรายการ กดปุ่ม “จด” เพื่อเริ่ม</p>}
        <ul className="tx-list">
          {recent.map((t) => {
            const mine = t.recorderEmail === state.email;
            const title =
              t.kind === 'transfer'
                ? `โอน ${walletName(t.walletId)} → ${walletName(t.toWalletId)}`
                : t.note || categoryName(t.categoryId) || (t.kind === 'adjustment' ? 'ปรับยอด' : 'ไม่ระบุ');
            return (
              <li key={t.id}>
                <button className="tx" disabled={!mine || t.kind === 'adjustment'} onClick={() => setEditing(t)}>
                  <div className="tx-main">
                    <span className="tx-title">{title}</span>
                    <span className="tx-meta">
                      {[
                        formatDay(t.occurredAt),
                        t.kind !== 'transfer' && walletName(t.walletId),
                        t.note && categoryName(t.categoryId),
                        !mine && `จดโดย ${nameOf(t.recorderEmail)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <span className={`tx-amount ${t.kind}`}>
                    {KIND_SIGN[t.kind] === 0 ? <Money amount={t.amount} /> : <Money amount={KIND_SIGN[t.kind] * t.amount} sign />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {editing && <QuickEntry editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
