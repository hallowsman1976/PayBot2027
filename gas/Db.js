/**
 * Sheets as tables. Each sheet is formatted as plain text so Sheets never turns ISO timestamps or IDs
 * into dates or numbers; values are coerced back to their real types by SCHEMA on read.
 *
 * Column types: s = string, sn = string or null, n = number, b = boolean, list = comma-separated strings.
 */
const SCHEMA = {
  wallets: {
    sheet: 'Wallets',
    key: 'id',
    columns: { id: 's', name: 's', type: 's', openingBalance: 'n', ownerEmail: 's', members: 'list', updatedAt: 's', deleted: 'b' },
  },
  transactions: {
    sheet: 'Transactions',
    key: 'id',
    columns: {
      id: 's', walletId: 's', kind: 's', amount: 'n', toWalletId: 'sn', categoryId: 'sn', note: 's',
      occurredAt: 's', recorderEmail: 's', updatedAt: 's', deleted: 'b',
    },
  },
  categories: {
    sheet: 'Categories',
    key: 'id',
    columns: { id: 's', name: 's', updatedAt: 's', deleted: 'b' },
  },
  jars: {
    sheet: 'Jars',
    key: 'id',
    columns: { id: 's', ownerEmail: 's', categoryId: 's', amount: 'n', updatedAt: 's', deleted: 'b' },
  },
  settings: {
    sheet: 'Settings',
    key: 'email',
    columns: { email: 's', displayName: 's', cycleStartDay: 'n', excludedWalletIds: 'list', updatedAt: 's' },
  },
  invites: {
    sheet: 'Invites',
    key: 'code',
    columns: { code: 's', walletId: 's', createdBy: 's', expiresAt: 's', usedBy: 'sn' },
  },
};

/** The household's data spreadsheet. A SPREADSHEET_ID Script Property overrides it (e.g. for a test copy). */
const DEFAULT_SPREADSHEET_ID = '1-V-yZLocY4dyIywbvV5nz5pXCjE-2xgJ1G1d87HOSQk';

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}

/** The sheet for a table, created with its header row on first use. */
function sheetFor_(table) {
  const def = SCHEMA[table];
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(def.sheet);
  if (!sheet) {
    sheet = ss.insertSheet(def.sheet);
    const header = Object.keys(def.columns);
    sheet.getRange(1, 1, sheet.getMaxRows(), header.length).setNumberFormat('@');
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function decode_(type, value) {
  switch (type) {
    case 'n': return value === '' ? 0 : Number(value);
    case 'b': return value === true || String(value).toLowerCase() === 'true';
    case 'list': return value === '' ? [] : String(value).split(',');
    case 'sn': return value === '' ? null : String(value);
    default: return String(value);
  }
}

function encode_(type, value) {
  switch (type) {
    case 'b': return value ? 'true' : 'false';
    case 'list': return (value || []).join(',');
    case 'sn': return value === null || value === undefined ? '' : String(value);
    case 'n': return String(Number(value) || 0);
    default: return value === null || value === undefined ? '' : String(value);
  }
}

/** Keeps only the schema's columns, coerced to their types — never trust the client's row shape. */
function clean_(table, row) {
  const cols = SCHEMA[table].columns;
  const out = {};
  Object.keys(cols).forEach((c) => {
    out[c] = decode_(cols[c], encode_(cols[c], row ? row[c] : undefined));
  });
  return out;
}

function readTable_(table) {
  const cols = SCHEMA[table].columns;
  const names = Object.keys(cols);
  const values = sheetFor_(table).getDataRange().getValues();
  return values.slice(1).filter((r) => r[0] !== '').map((r) => {
    const row = {};
    names.forEach((c, i) => {
      row[c] = decode_(cols[c], r[i] === undefined ? '' : r[i]);
    });
    return row;
  });
}

/** Rewrites a whole table. Tables stay small (one household), so a full rewrite is simpler than row patching. */
function writeTable_(table, rows) {
  const cols = SCHEMA[table].columns;
  const names = Object.keys(cols);
  const sheet = sheetFor_(table);
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, names.length).clearContent();
  if (rows.length === 0) return;
  sheet.getRange(2, 1, rows.length, names.length)
    .setNumberFormat('@')
    .setValues(rows.map((row) => names.map((c) => encode_(cols[c], row[c]))));
}

/** Loads tables into an in-memory db; save_ writes back only the ones marked dirty. */
function load_(tables) {
  const db = { dirty: {} };
  tables.forEach((t) => { db[t] = readTable_(t); });
  return db;
}

function save_(db) {
  Object.keys(db.dirty).forEach((t) => writeTable_(t, db[t]));
}

function upsert_(db, table, row) {
  const key = SCHEMA[table].key;
  const i = db[table].findIndex((r) => r[key] === row[key]);
  if (i >= 0) db[table][i] = row;
  else db[table].push(row);
  db.dirty[table] = true;
}
