/** Invites and membership. Only these calls change a Wallet's members; push never does. */

const INVITE_DAYS = 7;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function liveWallet_(db, walletId) {
  const wallet = db.wallets.find((w) => w.id === walletId && !w.deleted);
  if (!wallet) throw userError_('ไม่พบกระเป๋านี้');
  return wallet;
}

function touchWallet_(db, wallet) {
  wallet.updatedAt = new Date().toISOString();
  db.dirty.wallets = true;
}

function createInvite_(email, walletId) {
  const db = load_(['wallets', 'invites']);
  const wallet = liveWallet_(db, walletId);
  if (wallet.ownerEmail !== email) throw userError_('เชิญได้เฉพาะเจ้าของกระเป๋า');

  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  } while (db.invites.some((inv) => inv.code === code));

  const invite = {
    code: code,
    walletId: walletId,
    createdBy: email,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString(),
    usedBy: null,
  };
  upsert_(db, 'invites', invite);
  save_(db);
  return { code: invite.code, expiresAt: invite.expiresAt };
}

function acceptInvite_(email, code) {
  const db = load_(['wallets', 'invites']);
  const invite = db.invites.find((inv) => inv.code === String(code || '').trim().toUpperCase());
  if (!invite || invite.usedBy || invite.expiresAt < new Date().toISOString()) {
    throw userError_('รหัสเชิญไม่ถูกต้องหรือหมดอายุแล้ว');
  }
  const wallet = liveWallet_(db, invite.walletId);
  invite.usedBy = email;
  db.dirty.invites = true;
  if (wallet.members.indexOf(email) < 0) wallet.members.push(email);
  touchWallet_(db, wallet);
  save_(db);
  return { walletId: wallet.id };
}

function leaveWallet_(email, walletId) {
  const db = load_(['wallets']);
  const wallet = liveWallet_(db, walletId);
  if (wallet.ownerEmail === email) throw userError_('เจ้าของออกจากกระเป๋าไม่ได้ ให้ลบกระเป๋าแทน');
  wallet.members = wallet.members.filter((m) => m !== email);
  touchWallet_(db, wallet);
  save_(db);
}

function removeMember_(email, walletId, member) {
  const db = load_(['wallets']);
  const wallet = liveWallet_(db, walletId);
  if (wallet.ownerEmail !== email) throw userError_('เอาสมาชิกออกได้เฉพาะเจ้าของ');
  if (member === email) throw userError_('เจ้าของเอาตัวเองออกไม่ได้');
  wallet.members = wallet.members.filter((m) => m !== member);
  touchWallet_(db, wallet);
  save_(db);
}
