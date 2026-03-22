'use strict';

const { GoalNear } = require('mineflayer-pathfinder').goals;

const GOTO_TIMEOUT_MS = parseInt(process.env.GOTO_TEST_TIMEOUT_MS || '120000', 10);

function gotoWithTimeout(bot, goal, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try { bot.pathfinder?.setGoal(null); } catch (e) {}
      reject(new Error(`Pathfinding timed out after ${ms}ms`));
    }, ms);
    bot.pathfinder.goto(goal).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

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
    await gotoWithTimeout(bot, goal, GOTO_TIMEOUT_MS);
    return { success: true, reason: `Reached (${x}, ${y}, ${z}).` };
  } catch (err) {
    return { success: false, reason: err.message || 'Pathfinding failed.' };
  }
}

module.exports = { run };
