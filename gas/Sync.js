/**
 * pull / push. The server stamps updatedAt on every accepted row; a pull returns rows stamped at or after
 * the client's previous serverTime. Rules here are mirrored by app/src/data/mockServer.ts.
 */

const ALL_TABLES = ['wallets', 'transactions', 'categories', 'jars', 'settings'];
const KINDS = ['expense', 'income', 'transfer', 'adjustment'];
const WALLET_TYPES = ['bank', 'cash', 'credit'];

function isMember_(db, walletId, email) {
  return !!walletId && db.wallets.some((w) => w.id === walletId && !w.deleted && w.members.indexOf(email) >= 0);
}

function pull_(email, since) {
  const serverTime = new Date().toISOString();
  const db = load_(ALL_TABLES);
  const changed = (rows) => rows.filter((r) => !since || r.updatedAt >= since);

  const accessible = db.wallets.filter((w) => !w.deleted && w.members.indexOf(email) >= 0);
  const ids = accessible.map((w) => w.id);
  const memberEmails = {};
  accessible.forEach((w) => w.members.forEach((m) => { memberEmails[m] = true; }));

  return {
    serverTime: serverTime,
    accessibleWalletIds: ids,
    wallets: changed(db.wallets.filter((w) => w.members.indexOf(email) >= 0)),
    transactions: changed(db.transactions.filter((t) => ids.indexOf(t.walletId) >= 0 || (t.toWalletId && ids.indexOf(t.toWalletId) >= 0))),
    categories: changed(db.categories),
    jars: changed(db.jars.filter((j) => j.ownerEmail === email)),
    settings: db.settings.find((s) => s.email === email) || null,
    people: db.settings.filter((s) => memberEmails[s.email]).map((s) => ({ email: s.email, displayName: s.displayName })),
  };
}

function push_(email, changes) {
  if (!Array.isArray(changes)) throw userError_('ข้อมูลที่ส่งมาไม่ถูกต้อง');
  const stamp = new Date().toISOString();
  const db = load_(ALL_TABLES);
  const rejected = [];

  changes.forEach((change) => {
    const table = change && change.table;
    if (ALL_TABLES.indexOf(table) < 0) return;
    const row = clean_(table, change.row);
    const reason = applyChange_(db, email, table, row, stamp);
    if (reason) rejected.push({ table: table, id: row[SCHEMA[table].key], reason: reason });
  });

  save_(db);
  if (rejected.length) Logger.log('[push_] user=' + email + ' rejected=' + JSON.stringify(rejected));
  return { serverTime: stamp, rejected: rejected };
}

/** Applies one change if allowed; returns a Thai reason when it is rejected. */
function applyChange_(db, email, table, row, stamp) {
  if (!row[SCHEMA[table].key]) return 'ข้อมูลไม่มีรหัส';
  row.updatedAt = stamp;

  switch (table) {
    case 'wallets': {
      const existing = db.wallets.find((w) => w.id === row.id);
      if (existing && existing.ownerEmail !== email) return 'แก้ไขกระเป๋าได้เฉพาะเจ้าของ';
      if (WALLET_TYPES.indexOf(row.type) < 0) return 'ชนิดกระเป๋าไม่ถูกต้อง';
      // Ownership and membership only change through the sharing calls.
      row.ownerEmail = existing ? existing.ownerEmail : email;
      row.members = existing ? existing.members : [email];
      upsert_(db, 'wallets', row);
      return null;
    }
    case 'transactions': {
      const existing = db.transactions.find((t) => t.id === row.id);
      if (existing && existing.recorderEmail !== email) return 'แก้ไขได้เฉพาะรายการที่ตัวเองจด';
      if (KINDS.indexOf(row.kind) < 0) return 'ชนิดรายการไม่ถูกต้อง';
      if (!Number.isInteger(row.amount) || (row.kind !== 'adjustment' && row.amount <= 0)) return 'จำนวนเงินไม่ถูกต้อง';
      if (!isMember_(db, row.walletId, email)) return 'คุณไม่ได้เป็นสมาชิกของกระเป๋านี้';
      if (row.kind === 'transfer' && !isMember_(db, row.toWalletId, email)) return 'คุณไม่ได้เป็นสมาชิกของกระเป๋าปลายทาง';
      row.recorderEmail = email;
      upsert_(db, 'transactions', row);
      return null;
    }
    case 'categories':
      if (!row.name.trim()) return 'ชื่อหมวดว่าง';
      upsert_(db, 'categories', row);
      return null;
    case 'jars': {
      const existing = db.jars.find((j) => j.id === row.id);
      if (existing && existing.ownerEmail !== email) return 'แก้ไขได้เฉพาะกระปุกของตัวเอง';
      row.ownerEmail = email;
      upsert_(db, 'jars', row);
      return null;
    }
    case 'settings':
      row.email = email;
      row.cycleStartDay = Math.min(31, Math.max(1, Math.round(row.cycleStartDay) || 1));
      upsert_(db, 'settings', row);
      return null;
  }
  return 'ไม่รู้จักตาราง';
}
