'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;

const GOTO_MS = parseInt(process.env.WATER_BUCKET_GOTO_MS || '25000', 10);

function gotoTimeout(bot, goal, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try { bot.pathfinder?.setGoal(null); } catch (e) {}
      reject(new Error('goto timeout'));
    }, ms);
    bot.pathfinder.goto(goal).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function findWaterSource(bot, maxDist) {
  return bot.findBlock({
    point: bot.entity.position,
    matching: (b) => b && b.name === 'water',
    maxDistance: maxDist,
    count: 1,
  });
}

/**
 * Fill empty bucket from a water source block nearby.
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };

  if (bot.inventory.items().some((i) => i.name === 'water_bucket')) {
    return { success: true, reason: 'Already have a water bucket.' };
  }

  const bucket = bot.inventory.items().find((i) => i.name === 'bucket');
  if (!bucket) {
    return { success: false, reason: 'Need an empty bucket.' };
  }

  const maxDist = params.maxDistance ?? 48;
  const water = findWaterSource(bot, maxDist);
  if (!water) {
    return { success: false, reason: 'No water block found nearby.' };
  }

  try {
    await bot.equip(bucket, 'hand');
    await gotoTimeout(bot, new GoalGetToBlock(water.position.x, water.position.y, water.position.z), GOTO_MS);
  } catch (e) {
    return { success: false, reason: 'Could not reach water.' };
  }

  try {
    await bot.lookAt(water.position.offset(0.5, 0.5, 0.5), false);
    await bot.activateBlock(water, new Vec3(0, 1, 0));
  } catch (e) {
    return { success: false, reason: e.message || 'Failed to fill bucket.' };
  }

  const filled = bot.inventory.items().some((i) => i.name === 'water_bucket');
  return {
    success: filled,
    reason: filled ? 'Water bucket filled.' : 'Bucket still empty after use.',
  };
}

module.exports = { run, findWaterSource };
