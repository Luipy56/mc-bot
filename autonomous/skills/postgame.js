'use strict';

const { GoalNear } = require('mineflayer-pathfinder').goals;

/**
 * Optional post-dragon goals: End cities, Wither prep — extend with loot paths.
 */
async function runEndCity(bot, state, params) {
  const gateway = bot.findBlock({
    matching: (b) => b.name === 'end_gateway' || b.name === 'end_portal',
    maxDistance: 96,
  });
  if (!gateway) {
    return { success: false, reason: 'No End gateway / return portal found (explore island).' };
  }
  try {
    await bot.pathfinder.goto(
      new GoalNear(gateway.position.x, gateway.position.y, gateway.position.z, 3)
    );
    return { success: true, reason: 'Reached End gateway (elytra/shulker path: extend from here).' };
  } catch (e) {
    return { success: false, reason: e.message || 'Could not reach gateway.' };
  }
}

async function runWitherPrep(bot, state, params) {
  const skulls = bot.inventory.items().filter((i) => i.name === 'wither_skeleton_skull');
  const skullCount = skulls.reduce((s, i) => s + (i.count || 0), 0);
  const soulSand = bot.inventory.items().find((i) => i.name === 'soul_sand' || i.name === 'soul_soil');
  if (skullCount < 3 || !soulSand) {
    return {
      success: false,
      reason: 'Need 3 wither skulls + soul sand/soil (Nether fortress / bastion farm).',
    };
  }
  return {
    success: true,
    reason: 'Materials present for Wither; place T-shape safely in bedrock ceiling (manual template).',
  };
}

const runners = {
  postgame_end_city: runEndCity,
  postgame_wither_prep: runWitherPrep,
};

async function run(bot, state, params) {
  const key = params._taskId || state._currentTaskId;
  const fn = runners[key];
  if (fn) return fn(bot, state, params);
  return { success: false, reason: 'Unknown postgame task.' };
}

module.exports = { run, runEndCity, runWitherPrep };
