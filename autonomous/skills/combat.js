'use strict';

const { GoalFollow } = require('mineflayer-pathfinder').goals;

/**
 * Attack nearest entity of type. params: { mobName?: string, maxDistance?: number }.
 * If health low, flee instead (cancel pathfinder and move away).
 */
async function run(bot, state, params = {}) {
  const mobName = params.mobName || 'zombie';
  const maxDistance = params.maxDistance ?? 16;

  if (bot.health < 8) {
    bot.pathfinder.setGoal(null);
    bot.setControlState('forward', true);
    setTimeout(() => bot.setControlState('forward', false), 2000);
    return { success: true, reason: 'Low health, fleeing.' };
  }

  const entity = bot.nearestEntity((e) => e.name === mobName && e.position.distanceTo(bot.entity.position) < maxDistance);
  if (!entity) {
    return { success: false, reason: `No ${mobName} nearby.` };
  }

  try {
    bot.pathfinder.setGoal(new GoalFollow(entity, 2), true);
    await bot.attack(entity);
    return { success: true, reason: `Attacked ${mobName}.` };
  } catch (err) {
    bot.pathfinder.setGoal(null);
    return { success: false, reason: err.message || 'Attack failed.' };
  }
}

module.exports = { run };
