'use strict';

/**
 * Dimension helpers (Mineflayer 4.x / 1.20+ registry strings).
 */

function rawDimension(bot) {
  if (!bot) return '';
  try {
    const g = bot.game;
    if (g && g.dimension != null && g.dimension !== '') return String(g.dimension);
  } catch (e) { /* ignore */ }
  try {
    if (bot.entity && bot.entity.dimension != null && bot.entity.dimension !== '') {
      return String(bot.entity.dimension);
    }
  } catch (e2) { /* ignore */ }
  return '';
}

function isInNether(bot) {
  const r = rawDimension(bot).toLowerCase();
  if (!r) return false;
  if (r.includes('the_end') || r.includes('minecraft:the_end')) return false;
  return r.includes('nether');
}

function isInOverworld(bot) {
  const r = rawDimension(bot).toLowerCase();
  return r.includes('overworld') || r === '0';
}

module.exports = { rawDimension, isInNether, isInOverworld };
