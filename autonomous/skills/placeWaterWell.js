'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { setBlackboard } = require('../lib/state');

const GOTO_MS = parseInt(process.env.PLACE_WATER_GOTO_MS || '22000', 10);

function tillable(block) {
  if (!block) return false;
  return (
    block.name === 'grass_block'
    || block.name === 'dirt'
    || block.name === 'dirt_path'
    || block.name === 'rooted_dirt'
    || block.name === 'coarse_dirt'
  );
}

function airLike(b) {
  return b && (b.name === 'air' || b.name === 'cave_air' || b.name === 'void_air');
}

function gotoTimeout(bot, goal, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try {
        bot.pathfinder?.setGoal(null);
      } catch (e) { /* ignore */ }
      reject(new Error('goto timeout'));
    }, ms);
    bot.pathfinder.goto(goal).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function dist2XZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/**
 * Dig a one-block pit on grass/dirt and empty a water_bucket into it (infinite source).
 * params: { maxDistance?: number }
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };

  const waterBucket = bot.inventory.items().find((i) => i.name === 'water_bucket');
  if (!waterBucket) return { success: false, reason: 'Need a filled water bucket.' };

  const well = state?.blackboard?.jarvysWaterWell;
  if (well && well.x != null && well.y != null && well.z != null) {
    const existing = bot.blockAt(new Vec3(well.x, well.y, well.z));
    if (existing && existing.name === 'water') {
      return { success: true, reason: 'Water source already placed.' };
    }
  }

  const maxDist = params.maxDistance ?? 32;
  const positions = bot.findBlocks({
    point: bot.entity.position,
    matching: (b) => {
      if (!b || !tillable(b)) return false;
      if (!airLike(bot.blockAt(b.position.offset(0, 1, 0)))) return false;
      if (!airLike(bot.blockAt(b.position.offset(0, 2, 0)))) return false;
      return true;
    },
    maxDistance: maxDist,
    count: 48,
  });

  if (!positions || positions.length === 0) {
    return { success: false, reason: 'No grass/dirt spot with headroom nearby.' };
  }

  const bp = bot.entity.position;
  positions.sort((p, q) => dist2XZ(p, bp) - dist2XZ(q, bp));

  for (const center of positions) {
    const surfaceBlock = bot.blockAt(center);
    if (!surfaceBlock || !tillable(surfaceBlock)) continue;

    try {
      await gotoTimeout(
        bot,
        new GoalGetToBlock(surfaceBlock.position.x, surfaceBlock.position.y, surfaceBlock.position.z),
        GOTO_MS
      );
    } catch (e) {
      continue;
    }

    try {
      if (surfaceBlock.name !== 'water') {
        await bot.dig(surfaceBlock);
      }
    } catch (e) {
      continue;
    }

    const pitAir = bot.blockAt(center);
    if (!pitAir || pitAir.name !== 'air') continue;
    const below = bot.blockAt(center.offset(0, -1, 0));
    if (!below || below.name === 'air' || below.name === 'water' || below.name === 'flowing_water') continue;

    const wb = bot.inventory.items().find((i) => i.name === 'water_bucket');
    if (!wb) {
      return { success: false, reason: 'Lost water bucket before placing.' };
    }

    try {
      await bot.equip(wb, 'hand');
      await gotoTimeout(
        bot,
        new GoalGetToBlock(below.position.x, below.position.y, below.position.z),
        GOTO_MS
      );
      await bot.lookAt(center.offset(0.5, 0.5, 0.5), false);
      await bot.activateBlock(below, new Vec3(0, 1, 0));
    } catch (e) {
      continue;
    }

    const filled = bot.blockAt(center);
    if (filled && filled.name === 'water') {
      setBlackboard(state, 'jarvysWaterWell', { x: center.x, y: center.y, z: center.z });
      return {
        success: true,
        reason: `Placed water source at (${center.x}, ${center.y}, ${center.z}).`,
      };
    }
  }

  return { success: false, reason: 'Could not place water after trying nearby spots.' };
}

module.exports = { run, tillable };
