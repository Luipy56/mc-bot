'use strict';

const { countItems } = require('../lib/inventoryQuery');

/**
 * Craft bow/arrows/golden apple when materials exist; always succeeds so roadmap continues.
 */
async function run(bot, state, params = {}) {
  const craftingSkill = require('./crafting');

  if (countItems(bot, 'bow') < 1 && countItems(bot, 'string') >= 3 && countItems(bot, 'stick') >= 3) {
    await craftingSkill.run(bot, state, { itemName: 'bow', count: 1 });
  }

  const feather = countItems(bot, 'feather');
  const flint = countItems(bot, 'flint');
  const sticks = countItems(bot, 'stick');
  if (feather >= 1 && flint >= 1 && sticks >= 1 && countItems(bot, 'arrow') < 32) {
    const n = Math.min(16, feather, flint, sticks);
    await craftingSkill.run(bot, state, { itemName: 'arrow', count: n });
  }

  if (countItems(bot, 'golden_apple') < 1 && countItems(bot, 'gold_ingot') >= 8 && countItems(bot, 'apple') >= 1) {
    await craftingSkill.run(bot, state, { itemName: 'golden_apple', count: 1 });
  }

  const shield = bot.inventory.items().find((i) => i.name === 'shield');
  if (shield) {
    try {
      await bot.equip(shield, 'off-hand');
    } catch (e) { /* ignore */ }
  }

  return { success: true, reason: 'End combat prep applied (crafted/equipped what was possible).' };
}

module.exports = { run };
