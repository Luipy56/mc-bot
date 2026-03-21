'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');
const { setBlackboard } = require('../lib/state');

const GOTO_MS = parseInt(process.env.POTATO_FARM_GOTO_MS || '20000', 10);

/** 8 positions around center (water), same Y as surface */
const NEIGHBOR_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

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

function tillable(block) {
  if (!block) return false;
  return block.name === 'grass_block' || block.name === 'dirt' || block.name === 'dirt_path' || block.name === 'rooted_dirt';
}

/**
 * 3x3-style farm: dig center, place water, till 8 neighbors, plant potatoes.
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };

  const minPotatoes = params.minPotatoes ?? 8;
  if (countItems(bot, 'potato') < minPotatoes) {
    return { success: false, reason: `Need at least ${minPotatoes} potatoes; have ${countItems(bot, 'potato')}.` };
  }

  const hoe = bot.inventory.items().find((i) =>
    i.name === 'stone_hoe' || i.name === 'iron_hoe' || i.name === 'diamond_hoe' || i.name === 'wooden_hoe' || i.name === 'golden_hoe' || i.name === 'netherite_hoe');
  if (!hoe) return { success: false, reason: 'Need a hoe.' };

  const waterBucket = bot.inventory.items().find((i) => i.name === 'water_bucket');
  if (!waterBucket) return { success: false, reason: 'Need a filled water bucket.' };

  const sp = state?.blackboard?.spawnPos;
  let cx; let cy; let cz;
  const fo = state?.blackboard?.potatoFarmOrigin;
  if (fo && fo.x != null && fo.y != null && fo.z != null) {
    cx = fo.x;
    cy = fo.y;
    cz = fo.z;
  } else if (sp) {
    cx = sp.x - 10;
    cy = sp.y;
    cz = sp.z + 2;
    setBlackboard(state, 'potatoFarmOrigin', { x: cx, y: cy, z: cz });
  } else {
    const p = bot.entity.position;
    cx = Math.floor(p.x) - 8;
    cy = Math.floor(p.y);
    cz = Math.floor(p.z) + 2;
    setBlackboard(state, 'potatoFarmOrigin', { x: cx, y: cy, z: cz });
  }

  const center = new Vec3(cx, cy, cz);
  const surfaceBlock = bot.blockAt(center);
  if (!surfaceBlock || surfaceBlock.name === 'air') {
    return { success: false, reason: 'Farm center is not solid ground.' };
  }

  if (surfaceBlock.name !== 'water' && surfaceBlock.name !== 'farmland') {
    try {
      await bot.dig(surfaceBlock);
    } catch (e) {
      return { success: false, reason: 'Could not dig center for water pit.' };
    }
  }

  const pitAir = bot.blockAt(center);
  if (pitAir && pitAir.name === 'air') {
    const below = bot.blockAt(center.offset(0, -1, 0));
    if (!below || below.name === 'air') {
      return { success: false, reason: 'No floor under water pit.' };
    }
    try {
      await bot.equip(waterBucket, 'hand');
      await gotoTimeout(bot, new GoalGetToBlock(below.position.x, below.position.y, below.position.z), GOTO_MS);
      await bot.lookAt(center.offset(0.5, 0.5, 0.5), false);
      await bot.activateBlock(below, new Vec3(0, 1, 0));
    } catch (e) {
      return { success: false, reason: `Could not place water: ${e.message || e}` };
    }
  }

  for (const [dx, dz] of NEIGHBOR_OFFSETS) {
    const pos = new Vec3(cx + dx, cy, cz + dz);
    const b = bot.blockAt(pos);
    if (!b || b.name === 'water' || b.name === 'farmland') continue;
    if (!tillable(b)) continue;

    try {
      await bot.equip(hoe, 'hand');
      await gotoTimeout(bot, new GoalGetToBlock(b.position.x, b.position.y, b.position.z), GOTO_MS);
      await bot.activateBlock(b, new Vec3(0, 1, 0));
    } catch (e) {
      return { success: false, reason: `Tilling failed at (${pos.x},${pos.y},${pos.z}): ${e.message || e}` };
    }
  }

  let planted = 0;
  for (const [dx, dz] of NEIGHBOR_OFFSETS) {
    const farmPos = new Vec3(cx + dx, cy, cz + dz);
    const farm = bot.blockAt(farmPos);
    if (!farm || farm.name !== 'farmland') continue;
    const above = bot.blockAt(farmPos.offset(0, 1, 0));
    if (above && above.name !== 'air' && above.name !== 'cave_air' && above.name !== 'void_air') continue;

    const potatoItem = bot.inventory.items().find((i) => i.name === 'potato');
    if (!potatoItem) break;

    try {
      await bot.equip(potatoItem, 'hand');
      await gotoTimeout(bot, new GoalGetToBlock(farm.position.x, farm.position.y, farm.position.z), GOTO_MS);
      await bot.placeBlock(farm, new Vec3(0, 1, 0));
      planted++;
    } catch (e) {
      return { success: false, reason: `Planting failed at (${farmPos.x},${farmPos.y},${farmPos.z}): ${e.message || e}` };
    }
  }

  return {
    success: planted >= 4,
    reason: planted >= 4
      ? `Potato farm ready: ${planted} blocks planted near (${cx},${cy},${cz}).`
      : `Only planted ${planted} potatoes (need at least 4).`,
  };
}

module.exports = { run, NEIGHBOR_OFFSETS };
