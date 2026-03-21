'use strict';

const { countItems } = require('../lib/inventoryQuery');

const EDIBLE = [
  'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_cod', 'cooked_salmon',
  'apple', 'golden_apple', 'carrot', 'baked_potato', 'cooked_rabbit', 'beetroot', 'melon_slice', 'sweet_berries',
  'potato', 'cod', 'salmon', 'beef', 'porkchop', 'chicken', 'mutton', 'rabbit',
];

/**
 * Eat if food is low. params: { minFood?: number }.
 */
async function runEat(bot, state, params = {}) {
  const minFood = params.minFood ?? 15;
  if (bot.food >= minFood) {
    return { success: true, reason: 'Food OK.' };
  }

  const items = bot.inventory.items();
  const food = items.find((i) => i && EDIBLE.includes(i.name));
  if (!food) {
    return { success: false, reason: 'No food in inventory.' };
  }

  try {
    await bot.equip(food, 'hand');
    await bot.consume();
    return { success: true, reason: 'Ate food.' };
  } catch (err) {
    return { success: false, reason: err.message || 'Consume failed.' };
  }
}

module.exports = { run: runEat };
