/**
 * MeeTung API — GAS Web App used as the app's storage backend (see docs/adr/0003-gas-sheets-backend.md).
 *
 * The app POSTs text/plain JSON { fn, args, idToken } and gets back { ok, data } or { ok: false, message, code }.
 * Every call is verified against Google, checked against HOUSEHOLD_EMAILS, and runs under the script lock,
 * so a pull never reads half of a concurrent push.
 *
 * Script Properties:
 *   GOOGLE_CLIENT_ID  — the Web OAuth client ID the app signs in with
 *   HOUSEHOLD_EMAILS  — comma-separated emails allowed to use the API
 *   SPREADSHEET_ID    — optional; overrides DEFAULT_SPREADSHEET_ID in Db.js
 */

const APP_VERSION = '0.1.0';

/** Built on demand: functions in files loaded after this one do not exist yet at top level. */
function rpcHandlers_() {
  return {
    pull: pull_,
    push: push_,
    createInvite: createInvite_,
    acceptInvite: acceptInvite_,
    leaveWallet: leaveWallet_,
    removeMember: removeMember_,
  };
}

function doPost(e) {
  let fn = '?';
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    fn = payload.fn;
    const handlers = rpcHandlers_();
    const handler = Object.prototype.hasOwnProperty.call(handlers, fn) ? handlers[fn] : null;
    if (!handler) throw userError_('ไม่รู้จักคำสั่ง ' + fn);

    const email = requireUser_(payload.idToken);
    const args = Array.isArray(payload.args) ? payload.args : [];
    const data = withLock_(() => handler.apply(null, [email].concat(args)));
    return jsonOut_({ ok: true, data: data === undefined ? null : data });
  } catch (err) {
    Logger.log('[doPost] fn=' + fn + ' ' + (err && err.stack ? err.stack : err));
    return jsonOut_({
      ok: false,
      message: (err && err.userMessage) || 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์',
      code: (err && err.code) || 'SERVER',
    });
  }
}

/** Health check. */
function doGet() {
  return jsonOut_({ ok: true, service: 'MeeTung API', version: APP_VERSION });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** An error whose message is safe to show the user (Thai). */
function userError_(message, code) {
  const err = new Error(message);
  err.userMessage = message;
  err.code = code || 'SERVER';
  return err;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw userError_('เซิร์ฟเวอร์ไม่ว่าง ลองใหม่อีกครั้ง');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the editor after setting the Script Properties, to create the table sheets and check config. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  ['GOOGLE_CLIENT_ID', 'HOUSEHOLD_EMAILS'].forEach((name) => {
    if (!props.getProperty(name)) throw new Error('Missing Script Property ' + name);
  });
  Object.keys(SCHEMA).forEach(sheetFor_);
  Logger.log('Spreadsheet: ' + getSpreadsheet_().getUrl());
}
