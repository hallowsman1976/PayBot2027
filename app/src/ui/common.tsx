import type { ReactNode } from 'react';
import { formatBaht } from '../domain/money';
import type { Satang, WalletType } from '../domain/types';

export function Money({ amount, sign = false }: { amount: Satang; sign?: boolean }) {
  const prefix = amount < 0 ? '−' : sign && amount > 0 ? '+' : '';
  return (
    <span className="money">
      {prefix}฿{formatBaht(Math.abs(amount))}
    </span>
  );
}

export function Bar({ ratio, state }: { ratio: number; state: 'ok' | 'near' | 'over' }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}>
      <div className={`bar-fill ${state}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export const WALLET_TYPES: Record<WalletType, string> = {
  bank: 'บัญชีธนาคาร',
  cash: 'เงินสด',
  credit: 'บัตรเครดิต',
};

export const WALLET_ICONS: Record<WalletType, string> = { bank: '🏦', cash: '💵', credit: '💳' };

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
