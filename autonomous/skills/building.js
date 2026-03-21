'use strict';

const Vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;
const { setBlackboard } = require('../lib/state');

function isAirLike(name) {
  return name === 'air' || name === 'cave_air' || name === 'void_air';
}

function candidatePositions(x, y, z) {
  const offsets = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
    [2, 0], [-2, 0], [0, 2], [0, -2],
  ];
  return offsets.map(([dx, dz]) => new Vec3(x + dx, y, z + dz));
}

/**
 * Place a block at (x, y, z). params: { blockName: string, x, y, z }.
 * Places on top of block at (x, y-1, z).
 */
async function run(bot, state, params = {}) {
  const blockName = params.blockName || 'crafting_table';
  const x = params.x ?? Math.floor(bot.entity.position.x);
  const y = params.y ?? Math.floor(bot.entity.position.y);
  const z = params.z ?? Math.floor(bot.entity.position.z);

  const item = bot.inventory.items().find((i) => i.name === blockName);
  if (!item) {
    return { success: false, reason: `No ${blockName} in inventory.` };
  }

  const positions = params.x != null && params.y != null && params.z != null
    ? [new Vec3(x, y, z)]
    : candidatePositions(x, y, z);

  let lastErr = 'No valid placement surface nearby.';
  for (const pos of positions) {
    const below = pos.offset(0, -1, 0);
    const refBlock = bot.blockAt(below);
    const targetBlock = bot.blockAt(pos);
    if (!refBlock || isAirLike(refBlock.name)) continue;
    if (targetBlock && !isAirLike(targetBlock.name)) continue;

    try {
      const goal = new GoalNear(below.x, below.y, below.z, 2);
      await bot.pathfinder.goto(goal);
    } catch (e) {
      lastErr = 'Could not reach placement spot.';
      continue;
    }

    try {
      await bot.equip(item, 'hand');
      await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
      return { success: true, reason: `Placed ${blockName} at (${pos.x}, ${pos.y}, ${pos.z}).` };
    } catch (err) {
      lastErr = err.message || 'Place failed.';
      continue;
    }
  }

  if (/blockupdate|not allowed|cannot|can'?t place|protected|interact/i.test(String(lastErr).toLowerCase())) {
    setBlackboard(state, 'regionProtected', true);
  }
  return { success: false, reason: lastErr };
}

module.exports = { run };
