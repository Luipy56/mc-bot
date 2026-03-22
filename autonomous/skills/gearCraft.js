'use strict';

const crafting = require('./crafting');
const { countItems } = require('../lib/inventoryQuery');
const { markCompleted, unmarkCompleted } = require('../lib/state');

const IRON_ARMOR = ['iron_boots', 'iron_helmet', 'iron_leggings', 'iron_chestplate'];

function hasFullIronArmor(bot) {
  return IRON_ARMOR.every((n) => countItems(bot, n) >= 1);
}

function nextMissingPiece(bot) {
  const order = [
    { itemName: 'iron_boots', ingots: 4 },
    { itemName: 'iron_helmet', ingots: 5 },
    { itemName: 'iron_leggings', ingots: 7 },
    { itemName: 'iron_chestplate', ingots: 8 },
  ];
  for (const p of order) {
    if (countItems(bot, p.itemName) >= 1) continue;
    return p;
  }
  return null;
}

/**
 * Progress toward full iron armor; marks roadmap complete only when all four are in inventory.
 * Listed as noComplete in executor — we call markCompleted here once done.
 */
async function run(bot, state, params = {}) {
  if (hasFullIronArmor(bot)) {
    markCompleted(state, 'craft_iron_armor_set');
    return { success: true, reason: 'Iron armor complete.' };
  }

  const next = nextMissingPiece(bot);
  if (!next) {
    markCompleted(state, 'craft_iron_armor_set');
    return { success: true, reason: 'Iron armor complete.' };
  }

  if (countItems(bot, 'iron_ingot') < next.ingots) {
    unmarkCompleted(state, 'collect_iron_ore');
    unmarkCompleted(state, 'smelt_iron_ingots');
    return {
      success: false,
      reason: `Need ${next.ingots} iron ingots for ${next.itemName}; will re-mine and smelt.`,
    };
  }

  const r = await crafting.run(bot, state, { itemName: next.itemName, count: 1 });
  if (!r.success) return r;

  if (hasFullIronArmor(bot)) markCompleted(state, 'craft_iron_armor_set');
  return {
    success: true,
    reason: `Crafted ${next.itemName}; ${hasFullIronArmor(bot) ? 'set done.' : 'more pieces remain.'}`,
  };
}

module.exports = { run, hasFullIronArmor, nextMissingPiece };
