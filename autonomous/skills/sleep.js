'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;

/**
 * Find a bed block, go to it, and sleep. Sets spawn when successful.
 */
async function run(bot, state, params = {}) {
  if (bot.time?.isDay) {
    return { success: true, reason: 'Daytime; no need to sleep.' };
  }

  const bedBlock = bot.findBlock({ matching: (b) => b.name === 'red_bed' || b.name === 'white_bed' || b.name === 'bed', maxDistance: 32 });
  if (!bedBlock) {
    return { success: false, reason: 'No bed found nearby.' };
  }

  try {
    const goal = new GoalGetToBlock(bedBlock.position.x, bedBlock.position.y, bedBlock.position.z);
    await bot.pathfinder.goto(goal);
  } catch (e) {
    return { success: false, reason: e.message || 'Could not reach bed.' };
  }

  try {
    await bot.sleep(bedBlock);
    if (typeof bot.wake === 'function') {
      try { await bot.wake(); } catch (e) { /* morning may auto-wake */ }
    }
    return { success: true, reason: 'Slept; spawn set.' };
  } catch (err) {
    return { success: false, reason: err.message || 'Sleep failed.' };
  }
}

module.exports = { run };
