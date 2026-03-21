'use strict';

const { GoalNear } = require('mineflayer-pathfinder').goals;

/**
 * Walk to a semi-random point to load chunks / find new resources.
 * params: { forTask?: string } (for logging / brain callback).
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder || !bot.entity) {
    return { success: false, reason: 'No pathfinder or entity.' };
  }

  const base = state.blackboard?.spawnPos || {
    x: Math.floor(bot.entity.position.x),
    y: Math.floor(bot.entity.position.y),
    z: Math.floor(bot.entity.position.z),
  };

  const radius = 24 + Math.floor(Math.random() * 24);
  const angle = Math.random() * Math.PI * 2;
  const dx = Math.round(Math.cos(angle) * radius);
  const dz = Math.round(Math.sin(angle) * radius);
  let tx = base.x + dx;
  let ty = base.y;
  let tz = base.z + dz;
  tx = Math.round(tx);
  tz = Math.round(tz);

  const goal = new GoalNear(tx, ty, tz, 3);
  try {
    await bot.pathfinder.goto(goal);
    return { success: true, reason: `Explored toward (${tx}, ${ty}, ${tz}).` };
  } catch (e) {
    bot.pathfinder.setGoal(null);
    return { success: false, reason: e.message || 'Explore path failed.' };
  }
}

module.exports = { run };
