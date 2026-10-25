import { useState } from 'react';
import { addCategory, saveSettings, setJar } from '../data/actions';
import { formatBaht, parseBaht } from '../domain/money';
import { Money } from './common';
import { useApp, useData } from './context';

export function Jars() {
  const { state, categories, jars, summary } = useData();
  const { session, signOut } = useApp();
  const [newCategory, setNewCategory] = useState('');
  const settings = state.settings;
  const myJar = (categoryId: string) => jars.find((j) => j.categoryId === categoryId && j.ownerEmail === state.email);

  return (
    <div className="screen">
      <h1 className="screen-title">กระปุก</h1>
      <p className="muted">
        งบรวมรอบนี้ <Money amount={summary?.budgetTotal ?? 0} /> · เว้นว่างถ้าหมวดนั้นไม่ต้องมีกระปุก
      </p>

      <ul className="jar-edit-list">
        {categories.map((c) => (
          <JarRow key={c.id} name={c.name} amount={myJar(c.id)?.amount ?? 0} onSave={(amount) => setJar(c.id, amount)} />
        ))}
      </ul>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newCategory.trim();
          if (name && !categories.some((c) => c.name === name)) addCategory(name);
          setNewCategory('');
        }}
      >
        <input placeholder="เพิ่มหมวด (ใช้ร่วมกันทั้งครัวเรือน)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
        <button className="secondary" disabled={!newCategory.trim()}>เพิ่ม</button>
      </form>

      {settings && (
        <section className="settings">
          <h2 className="section-title">ตั้งค่า</h2>
          <label className="field">
            <span>วันเริ่มรอบ</span>
            <select
              value={settings.cycleStartDay}
              onChange={(e) => saveSettings({ ...settings, cycleStartDay: Number(e.target.value) })}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  วันที่ {d}
                </option>
              ))}
            </select>
          </label>
          <SyncStatus />
          <p className="muted">ล็อกอินเป็น {session.email}</p>
          <button className="danger-link" onClick={signOut}>ออกจากระบบ</button>
        </section>
      )}
    </div>
  );
}

function JarRow({ name, amount, onSave }: { name: string; amount: number; onSave: (amount: number) => void }) {
  const [text, setText] = useState(amount ? formatBaht(amount) : '');
  const commitText = () => {
    const parsed = text.trim() === '' ? 0 : parseBaht(text);
    if (parsed === null) {
      setText(amount ? formatBaht(amount) : '');
      return;
    }
    if (parsed !== amount) onSave(parsed);
  };
  return (
    <li className="jar-edit">
      <span>{name}</span>
      <input
        inputMode="decimal"
        placeholder="—"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </li>
  );
}

function SyncStatus() {
  const { state } = useData();
  const { syncNow } = useApp();
  const { status, message } = state.sync;
  const label = {
    idle: 'ซิงก์แล้ว',
    syncing: 'กำลังซิงก์…',
    offline: 'ออฟไลน์ จะซิงก์เมื่อกลับมาออนไลน์',
    error: `ซิงก์ไม่สำเร็จ: ${message ?? ''}`,
  }[status];
  return (
    <div className="row sync-row">
      <span className={`sync-dot ${status}`} />
      <span className="muted">
        {label}
        {state.outbox.length > 0 && ` · รอส่ง ${state.outbox.length} รายการ`}
      </span>
      <button className="secondary small" onClick={() => void syncNow()}>ซิงก์</button>
    </div>
  );
}
