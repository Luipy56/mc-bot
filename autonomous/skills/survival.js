'use strict';

const { findBestFoodItem } = require('../lib/food');

/**
 * Eat if food is low. params: { minFood?: number }.
 */
async function runEat(bot, state, params = {}) {
  const minFood = params.minFood ?? 15;
  if (bot.food >= minFood) {
    return { success: true, reason: 'Food OK.' };
  }

  const food = findBestFoodItem(bot);
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
