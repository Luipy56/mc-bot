'use strict';

const { setBlackboard } = require('./state');

const COOLDOWN_MS = Math.max(15000, parseInt(process.env.MINING_HELP_CHAT_COOLDOWN_MS || '90000', 10));

function helpChatEnabled() {
  return !/^(0|false|no|off)$/i.test(process.env.MINING_HELP_CHAT ?? '1');
}

function pickLine(kind) {
  const es = /^(es|spa)/i.test(process.env.MINING_HELP_LANG || process.env.JARVYS_LANG || 'en');
  if (kind === 'obsidian_pick') {
    return es
      ? 'Tengo obsidiana delante pero no tengo pico de diamante o netherita. ¿Alguien puede prestarme uno o picar por mí?'
      : "I'm facing obsidian but don't have a diamond or netherite pickaxe—can someone lend me one or break it for me?";
  }
  if (kind === 'ancient_debris_pick') {
    return es
      ? 'Necesito pico de diamante o mejor para ancient debris y no lo tengo. ¿Ayuda?'
      : "I need a diamond+ pick for ancient debris and don't have one—can anyone help?";
  }
  return null;
}

/**
 * Ask players for tools when mining is blocked by gear (rate-limited).
 * @param {import('mineflayer').Bot} bot
 * @param {object} state
 * @param {{ abort?: boolean, kind?: string }} detail - from shouldAbortMiningBlock
 */
function maybeAskMiningToolHelp(bot, state, detail) {
  if (!helpChatEnabled() || !bot?.chat || !state?.blackboard) return;
  if (!detail || !detail.abort) return;
  const kind = detail.kind;
  if (kind !== 'obsidian_pick' && kind !== 'ancient_debris_pick') return;

  const now = Date.now();
  const last = state.blackboard.lastMiningHelpChatAt || 0;
  if (now - last < COOLDOWN_MS) return;

  const custom =
    kind === 'obsidian_pick'
      ? (process.env.MINING_HELP_CHAT_OBSIDIAN || '').trim()
      : (process.env.MINING_HELP_CHAT_ANCIENT_DEBRIS || '').trim();
  const line = custom || pickLine(kind);
  if (!line) return;

  if (state.blackboard.authRequired && !state.blackboard.authReady) return;

  try {
    bot.chat(line);
    setBlackboard(state, 'lastMiningHelpChatAt', now);
    console.log('[MiningHelp] Asked in chat:', line.slice(0, 80) + (line.length > 80 ? '…' : ''));
  } catch (e) {
    console.warn('[MiningHelp] chat failed:', e.message || e);
  }
}

module.exports = { maybeAskMiningToolHelp, pickLine, COOLDOWN_MS };
