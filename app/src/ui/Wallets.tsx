import { useState } from 'react';
import { addWallet, adjustBalance, saveSettings, updateWallet } from '../data/actions';
import type { Invite } from '../data/backend';
import { adjustmentFor, walletBalance } from '../domain/balance';
import { parseBaht } from '../domain/money';
import type { Wallet, WalletType } from '../domain/types';
import { Money, Sheet, WALLET_ICONS, WALLET_TYPES } from './common';
import { useApp, useData } from './context';

export function Wallets() {
  const { wallets, transactions, state } = useData();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [joining, setJoining] = useState(false);
  const open = wallets.find((w) => w.id === openId);

  return (
    <div className="screen">
      <h1 className="screen-title">กระเป๋า</h1>
      <ul className="wallet-list">
        {wallets.map((w) => (
          <li key={w.id}>
            <button className="wallet" onClick={() => setOpenId(w.id)}>
              <span className="wallet-icon">{WALLET_ICONS[w.type]}</span>
              <span className="wallet-main">
                <span className="wallet-name">{w.name}</span>
                <span className="wallet-meta">
                  {WALLET_TYPES[w.type]}
                  {w.members.length > 1 ? ` · แชร์ ${w.members.length} คน` : ''}
                  {state.settings?.excludedWalletIds.includes(w.id) ? ' · ไม่นับในงบ' : ''}
                </span>
              </span>
              <span className="wallet-balance">
                <Money amount={walletBalance(w, transactions)} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="secondary" onClick={() => setAdding(true)}>+ เพิ่มกระเป๋า</button>
        <button className="secondary" onClick={() => setJoining(true)}>เข้าร่วมด้วยรหัส</button>
      </div>

      {adding && <AddWallet onClose={() => setAdding(false)} />}
      {joining && <JoinWallet onClose={() => setJoining(false)} />}
      {open && <WalletDetail wallet={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function AddWallet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('bank');
  const [opening, setOpening] = useState('');
  const isCredit = type === 'credit';

  return (
    <Sheet title="เพิ่มกระเป๋า" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = opening.trim() === '' ? 0 : parseBaht(opening);
          if (!name.trim() || amount === null) return;
          // A credit card's opening balance is debt, entered as a positive number.
          addWallet(name.trim(), type, isCredit ? -amount : amount);
          onClose();
        }}
      >
        <input placeholder="ชื่อ เช่น กสิกร, เงินสด" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="segmented">
          {(Object.keys(WALLET_TYPES) as WalletType[]).map((t) => (
            <button type="button" key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
              {WALLET_TYPES[t]}
            </button>
          ))}
        </div>
        <input
          inputMode="decimal"
          placeholder={isCredit ? 'ยอดค้างชำระตอนนี้' : 'ยอดเงินตอนนี้ (ยอดตั้งต้น)'}
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
        />
        <button className="primary" disabled={!name.trim()}>เพิ่ม</button>
      </form>
    </Sheet>
  );
}

function JoinWallet({ onClose }: { onClose: () => void }) {
  const { backend, syncNow } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title="เข้าร่วมกระเป๋า" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await backend.acceptInvite(code);
            await syncNow();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="code-input"
          placeholder="รหัสเชิญ 6 ตัว"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus
        />
        <button className="primary" disabled={code.length !== 6 || busy}>เข้าร่วม</button>
        {error && <p className="error">{error}</p>}
      </form>
    </Sheet>
  );
}

function WalletDetail({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const { backend, syncNow } = useApp();
  const { state, transactions, nameOf } = useData();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [actual, setActual] = useState('');
  const [name, setName] = useState(wallet.name);
  const [error, setError] = useState<string | null>(null);
  const isOwner = wallet.ownerEmail === state.email;
  const balance = walletBalance(wallet, transactions);
  const settings = state.settings;
  const counted = settings ? !settings.excludedWalletIds.includes(wallet.id) : true;

  async function run(action: () => Promise<unknown>, close = false) {
    setError(null);
    try {
      await action();
      await syncNow();
      if (close) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Sheet title={wallet.name} onClose={onClose}>
      <div className="detail-balance">
        <span className="muted">{WALLET_TYPES[wallet.type]} · ยอดตอนนี้</span>
        <Money amount={balance} />
      </div>

      {settings && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={counted}
            onChange={(e) =>
              saveSettings({
                ...settings,
                excludedWalletIds: e.target.checked
                  ? settings.excludedWalletIds.filter((id) => id !== wallet.id)
                  : [...settings.excludedWalletIds, wallet.id],
              })
            }
          />
          นับในงบของฉัน
        </label>
      )}

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const target = parseBaht(actual.replace(/^-/, ''));
          if (target === null) return;
          const signed = actual.trim().startsWith('-') || wallet.type === 'credit' ? -target : target;
          adjustBalance(wallet.id, adjustmentFor(balance, signed));
          setActual('');
        }}
      >
        <input
          inputMode="decimal"
          placeholder={wallet.type === 'credit' ? 'ยอดค้างจริงตามธนาคาร' : 'ยอดจริงตามธนาคาร'}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
        <button className="secondary" disabled={!actual}>ปรับยอด</button>
      </form>

      <h3 className="section-title">สมาชิก</h3>
      <ul className="member-list">
        {wallet.members.map((m) => (
          <li key={m}>
            <span>
              {nameOf(m)}
              {m === wallet.ownerEmail && <span className="badge">เจ้าของ</span>}
            </span>
            {isOwner && m !== state.email && (
              <button className="danger-link" onClick={() => run(() => backend.removeMember(wallet.id, m))}>
                เอาออก
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="stack">
          {invite ? (
            <div className="invite">
              <span className="invite-code">{invite.code}</span>
              <span className="muted">ส่งรหัสนี้ให้คนที่จะแชร์ ใช้ได้ถึง {new Date(invite.expiresAt).toLocaleDateString('th-TH')}</span>
            </div>
          ) : (
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  await syncNow(); // a Wallet created offline must reach the server before it can be shared
                  setInvite(await backend.createInvite(wallet.id));
                })
              }
            >
              สร้างรหัสเชิญ
            </button>
          )}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) updateWallet(wallet, { name: name.trim() });
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อกระเป๋า" />
            <button className="secondary" disabled={name.trim() === wallet.name}>เปลี่ยนชื่อ</button>
          </form>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {isOwner ? (
        <button
          className="danger-link"
          onClick={() => {
            if (confirm(`ลบกระเป๋า “${wallet.name}”? สมาชิกทุกคนจะไม่เห็นกระเป๋านี้อีก`)) {
              updateWallet(wallet, { deleted: true });
              onClose();
            }
          }}
        >
          ลบกระเป๋า
        </button>
      ) : (
        <button
          className="danger-link"
          onClick={() => confirm(`ออกจากกระเป๋า “${wallet.name}”? รายการที่คุณจดไว้จะยังอยู่`) && run(() => backend.leaveWallet(wallet.id), true)}
        >
          ออกจากกระเป๋า
        </button>
      )}
    </Sheet>
  );
}
