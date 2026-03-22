'use strict';

const { findBestFoodItem } = require('../lib/food');
const humanPlayer = require('../lib/humanPlayer');

/**
 * Eat if food is low. params: { minFood?: number }.
 */
async function runEat(bot, state, params = {}) {
  const minFood = params.minFood ?? 15;
  if (bot.food >= minFood) {
    return { success: true, reason: 'Food OK.' };
  }

  let bites = 0;
  const maxBites = parseInt(process.env.EAT_MAX_BITES_PER_TASK || '12', 10);
  while (bot.food < minFood && bites < maxBites) {
    const food = findBestFoodItem(bot);
    if (!food) {
      return {
        success: bites > 0,
        reason: bites > 0 ? `Ate ${bites} time(s); out of food.` : 'No food in inventory.',
      };
    }
    try {
      await humanPlayer.beforeEat(bot);
      await bot.equip(food, 'hand');
      await bot.consume();
      await new Promise((r) => setTimeout(r, 480));
      bites++;
    } catch (err) {
      return { success: bites > 0, reason: err.message || 'Consume failed.' };
    }
  }
  return {
    success: bot.food >= minFood,
    reason: bot.food >= minFood ? `Food >= ${minFood} after eating.` : `Still hungry (${bot.food}/${minFood}).`,
  };
}

module.exports = { run: runEat };
