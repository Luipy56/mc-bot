'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;

/**
 * Place a block at (x, y, z). params: { blockName: string, x, y, z }.
 * Places on top of block at (x, y-1, z).
 */
async function run(bot, state, params = {}) {
  const blockName = params.blockName || 'crafting_table';
  const x = params.x ?? Math.floor(bot.entity.position.x);
  const y = params.y ?? Math.floor(bot.entity.position.y);
  const z = params.z ?? Math.floor(bot.entity.position.z);

  const below = new Vec3(x, y - 1, z);
  const refBlock = bot.blockAt(below);
  if (!refBlock || refBlock.name === 'air') {
    return { success: false, reason: 'No solid block below place position.' };
  }

  const item = bot.inventory.items().find((i) => i.name === blockName);
  if (!item) {
    return { success: false, reason: `No ${blockName} in inventory.` };
  }

  try {
    const goal = new GoalGetToBlock(below.x, below.y, below.z);
    await bot.pathfinder.goto(goal);
  } catch (e) {
    return { success: false, reason: 'Could not reach position.' };
  }

  const faceVector = new Vec3(0, 1, 0);
  try {
    await bot.equip(item, 'hand');
    await bot.placeBlock(refBlock, faceVector);
    return { success: true, reason: `Placed ${blockName}.` };
  } catch (err) {
    return { success: false, reason: err.message || 'Place failed.' };
  }
}

module.exports = { run };
