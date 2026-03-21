'use strict';

const { GoalNear } = require('mineflayer-pathfinder').goals;

/**
 * run(bot, state, params) for taskId 'goto_test'.
 * params: { x, y, z } (default 0, 64, 0).
 */
async function run(bot, state, params = {}) {
  const x = params.x ?? 0;
  const y = params.y ?? 64;
  const z = params.z ?? 0;

  if (!bot.pathfinder) {
    return { success: false, reason: 'Pathfinder not loaded.' };
  }

  const goal = new GoalNear(x, y, z, 2);
  try {
    await bot.pathfinder.goto(goal);
    return { success: true, reason: `Reached (${x}, ${y}, ${z}).` };
  } catch (err) {
    return { success: false, reason: err.message || 'Pathfinding failed.' };
  }
}

module.exports = { run };
