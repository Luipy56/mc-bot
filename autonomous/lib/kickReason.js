'use strict';

/**
 * Normalize Mineflayer kick payloads (string, JSON chat, prismarine chat objects) for logging and backoff.
 */
function formatKickReason(reason) {
  if (typeof reason === 'string') {
    const s = reason.trim();
    if (s.startsWith('{') && s.includes('text')) {
      try {
        const o = JSON.parse(s);
        if (o && typeof o.text === 'string') return o.text;
      } catch (e) { /* ignore */ }
    }
    return s;
  }
  if (reason && typeof reason === 'object') {
    const v = reason.value;
    if (v && typeof v.text === 'object' && v.text?.value) return String(v.text.value);
    if (typeof reason.text === 'string') return reason.text;
    if (v && typeof v.text === 'string') return v.text;
    const extra = v?.extra?.value;
    if (Array.isArray(extra) && extra[0]?.text?.value) return String(extra[0].text.value);
  }
  try {
    return JSON.stringify(reason);
  } catch (e) {
    return String(reason);
  }
}

/** True if we should wait longer before reconnecting (server rate limits / duplicate session). */
function kickNeedsSlowReconnect(formattedReason) {
  return /wait|throttle|again|already playing|logged in from another|timeout exceeded|wrong password|incorrect password|invalid password|contrasena|contraseña/i.test(String(formattedReason || ''));
}

module.exports = { formatKickReason, kickNeedsSlowReconnect };
