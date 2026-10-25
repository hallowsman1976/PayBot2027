import { useMemo, useState } from 'react';
import { deleteTransaction, saveTransaction } from '../data/actions';
import { dayKeyOf, todayKey } from '../domain/cycle';
import { guessCategory, guessWallet } from '../domain/guess';
import { evaluate, hasOperator, pressKey, type KeypadKey } from '../domain/keypad';
import { formatBaht } from '../domain/money';
import type { Transaction, TransactionKind } from '../domain/types';
import { Sheet } from './common';
import { useData } from './context';

const KEYS: { key: KeypadKey; label: string }[] = [
  { key: '7', label: '7' }, { key: '8', label: '8' }, { key: '9', label: '9' }, { key: 'back', label: '⌫' },
  { key: '4', label: '4' }, { key: '5', label: '5' }, { key: '6', label: '6' }, { key: '-', label: '−' },
  { key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' }, { key: '+', label: '+' },
  { key: 'clear', label: 'C' }, { key: '0', label: '0' }, { key: '.', label: '.' },
];

const KINDS: { kind: TransactionKind; label: string }[] = [
  { kind: 'expense', label: 'รายจ่าย' },
  { kind: 'income', label: 'รายรับ' },
  { kind: 'transfer', label: 'โอน' },
];

const exprFor = (t?: Transaction) => (t ? String(t.amount / 100) : '');

export function QuickEntry({ editing, onClose }: { editing?: Transaction; onClose: () => void }) {
  const { state, wallets, transactions, categories } = useData();
  const walletIds = useMemo(() => wallets.map((w) => w.id), [wallets]);

  const [kind, setKind] = useState<TransactionKind>(editing?.kind ?? 'expense');
  const [expr, setExpr] = useState(exprFor(editing));
  const [note, setNote] = useState(editing?.note ?? '');
  const [pickedCategory, setPickedCategory] = useState<string | null | undefined>(editing ? editing.categoryId : undefined);
  const [walletId, setWalletId] = useState(editing?.walletId ?? guessWallet(transactions, state.email, walletIds) ?? '');
  const [toWalletId, setToWalletId] = useState(editing?.toWalletId ?? walletIds.find((id) => id !== walletId) ?? '');
  const [day, setDay] = useState(editing ? dayKeyOf(editing.occurredAt) : todayKey());

  // Until the user picks one, the category follows what they used last time for the same note.
  const categoryId = pickedCategory === undefined ? guessCategory(transactions, state.email, note) : pickedCategory;
  const amount = evaluate(expr);
  const valid =
    amount !== null && amount > 0 && walletId !== '' && (kind !== 'transfer' || (toWalletId !== '' && toWalletId !== walletId));

  function save() {
    if (!valid || amount === null) return;
    const occurredAt =
      editing && day === dayKeyOf(editing.occurredAt)
        ? editing.occurredAt
        : day === todayKey()
          ? new Date().toISOString()
          : new Date(`${day}T12:00`).toISOString();
    saveTransaction({ walletId, kind, amount, toWalletId, categoryId, note: note.trim(), occurredAt }, editing);
    onClose();
  }

  if (wallets.length === 0) {
    return (
      <Sheet title="จด" onClose={onClose}>
        <p className="muted">ยังไม่มีกระเป๋า เพิ่มกระเป๋าก่อนในแท็บกระเป๋า</p>
      </Sheet>
    );
  }

  return (
    <Sheet title={editing ? 'แก้ไขรายการ' : 'จด'} onClose={onClose}>
      <div className="segmented">
        {KINDS.map((k) => (
          <button key={k.kind} className={kind === k.kind ? 'active' : ''} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>

      <div className={`display ${kind}`}>
        <div className="display-expr">{hasOperator(expr) ? expr.replace(/-/g, '−') : ' '}</div>
        <div className="display-total">฿{amount === null ? '0' : formatBaht(Math.abs(amount))}</div>
      </div>

      <input className="note-input" placeholder="โน้ต เช่น ข้าวมันไก่" value={note} onChange={(e) => setNote(e.target.value)} />

      {kind !== 'transfer' && (
        <div className="chips">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip ${categoryId === c.id ? 'active' : ''}`}
              ref={categoryId === c.id ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) : undefined}
              onClick={() => setPickedCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="row">
        <label className="field">
          <span>{kind === 'transfer' ? 'จาก' : 'กระเป๋า'}</span>
          <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {kind === 'transfer' && (
          <label className="field">
            <span>ไป</span>
            <select value={toWalletId} onChange={(e) => setToWalletId(e.target.value)}>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>วันที่</span>
          <input type="date" value={day} max={todayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k.key} className={`key ${k.key.length > 1 || '+-'.includes(k.key) ? 'key-op' : ''}`} onClick={() => setExpr(pressKey(expr, k.key))}>
            {k.label}
          </button>
        ))}
        <button className="key key-save" disabled={!valid} onClick={save}>
          บันทึก
        </button>
      </div>

      {editing && (
        <button
          className="danger-link"
          onClick={() => {
            deleteTransaction(editing);
            onClose();
          }}
        >
          ลบรายการนี้
        </button>
      )}
    </Sheet>
  );
}
