/**
 * Verifies a Google ID token and returns the caller's email. Verified tokens are cached until they expire,
 * so only the first call per token pays for the tokeninfo round trip.
 */
function requireUser_(idToken) {
  if (!idToken) throw userError_('กรุณาล็อกอิน', 'AUTH');

  const cache = CacheService.getScriptCache();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken);
  const cacheKey = 'tok_' + Utilities.base64EncodeWebSafe(digest);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true },
  );
  if (res.getResponseCode() !== 200) throw userError_('การล็อกอินหมดอายุ', 'AUTH');

  const info = JSON.parse(res.getContentText());
  const props = PropertiesService.getScriptProperties();
  if (info.aud !== props.getProperty('GOOGLE_CLIENT_ID')) throw userError_('การล็อกอินไม่ถูกต้อง', 'AUTH');
  if (String(info.email_verified) !== 'true') throw userError_('อีเมลยังไม่ได้ยืนยันกับ Google', 'AUTH');

  const email = String(info.email).toLowerCase();
  if (householdEmails_().indexOf(email) < 0) {
    Logger.log('[requireUser_] rejected email not in household: ' + email);
    throw userError_('อีเมลนี้ไม่ได้อยู่ในครัวเรือน ติดต่อผู้ดูแลแอป');
  }

  const ttl = Math.min(21600, Number(info.exp) - Math.floor(Date.now() / 1000));
  if (ttl > 0) cache.put(cacheKey, email, ttl);
  return email;
}

function householdEmails_() {
  return (PropertiesService.getScriptProperties().getProperty('HOUSEHOLD_EMAILS') || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(String);
}
