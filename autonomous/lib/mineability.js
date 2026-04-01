'use strict';

const { countItems } = require('./inventoryQuery');
const { setBlackboard } = require('./state');
const { maybeAskMiningToolHelp } = require('./miningHelpChat');

/** Survival: cannot break (or not worth trying). */
const NEVER_MINE_NAMES = new Set([
  'bedrock',
  'barrier',
  'reinforced_deepslate',
  'end_portal',
  'end_gateway',
  'end_portal_frame',
]);

function hasDiamondOrNetheritePick(bot) {
  return countItems(bot, 'diamond_pickaxe') >= 1 || countItems(bot, 'netherite_pickaxe') >= 1;
}

/**
 * Avoid softlock: bedrock, barriers, obsidian/ancient_debris without proper pick, etc.
 * @returns {{ abort: boolean, reason?: string, kind?: 'unbreakable' | 'wrong_tool' }}
 */
function shouldAbortMiningBlock(bot, block) {
  if (!block || !block.name) return { abort: true, reason: 'no_block', kind: 'wrong_tool' };
  const name = block.name;

  if (NEVER_MINE_NAMES.has(name)) {
    return { abort: true, reason: `unbreakable:${name}`, kind: 'unbreakable' };
  }

  if (name === 'obsidian' || name.includes('obsidian')) {
    if (!hasDiamondOrNetheritePick(bot)) {
      return {
        abort: true,
        reason: 'obsidian needs diamond or netherite pick (skipping to avoid multi-minute softlock)',
        kind: 'obsidian_pick',
      };
    }
  }

  if (name.includes('ancient_debris')) {
    if (!hasDiamondOrNetheritePick(bot)) {
      return {
        abort: true,
        reason: 'ancient_debris needs diamond+ pick',
        kind: 'ancient_debris_pick',
      };
    }
  }

  return { abort: false };
}

const DEFAULT_MAX_DIG_MS = parseInt(process.env.SOFTLOCK_MAX_DIG_MS || '180000', 10);

/**
 * Dig with wall clock cap so wrong-tool / lag cannot softlock for 10+ minutes.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function digWithSoftlockGuard(bot, block, state) {
  const pre = shouldAbortMiningBlock(bot, block);
  if (pre.abort) {
    maybeAskMiningToolHelp(bot, state, pre);
    return { ok: false, reason: pre.reason || 'abort', kind: pre.kind };
  }

  const maxMs = Math.max(5000, DEFAULT_MAX_DIG_MS);
  let finished = false;
  const timer = setTimeout(() => {
    if (finished) return;
    try {
      if (bot && typeof bot.stopDigging === 'function') bot.stopDigging();
    } catch (e) { /* ignore */ }
  }, maxMs);

  try {
    await bot.dig(block);
    finished = true;
    clearTimeout(timer);
    return { ok: true };
  } catch (e) {
    finished = true;
    clearTimeout(timer);
    const raw = String(e?.message || e || '');
    const low = raw.toLowerCase();
    if (low.includes("can't break") || low.includes('cannot break') || low.includes('protected')) {
      throw e;
    }
    if (/digging aborted|aborted/i.test(raw)) {
      try {
        setBlackboard(state, 'lastSoftlockDig', {
          x: block.position?.x,
          y: block.position?.y,
          z: block.position?.z,
          name: block.name,
          at: Date.now(),
        });
      } catch (e2) { /* ignore */ }
      return { ok: false, reason: raw };
    }
    throw e;
  }
}

module.exports = {
  NEVER_MINE_NAMES,
  shouldAbortMiningBlock,
  digWithSoftlockGuard,
  hasDiamondOrNetheritePick,
  DEFAULT_MAX_DIG_MS,
};
