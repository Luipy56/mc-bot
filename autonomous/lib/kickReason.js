'use strict';

/**
 * Collect only Minecraft chat `text` fragments (ignore color/italic/etc. string nodes).
 */
function collectChatTextFragments(node, depth, out) {
  if (depth > 24 || node == null || typeof node !== 'object') return;
  if (node.text != null) {
    if (typeof node.text === 'string') {
      const t = node.text.trim();
      if (t) out.push(t);
    } else if (node.text.type === 'string' && typeof node.text.value === 'string') {
      const t = node.text.value.trim();
      if (t) out.push(t);
    }
  }
  for (const k of Object.keys(node)) {
    collectChatTextFragments(node[k], depth + 1, out);
  }
}

function extractChatTextDeep(node) {
  const parts = [];
  collectChatTextFragments(node, 0, parts);
  if (parts.length === 0) return '';
  return parts.sort((a, b) => b.length - a.length)[0];
}

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
    const deep = extractChatTextDeep(reason);
    if (deep) return deep;
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
