'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

const GOTO_MS = parseInt(process.env.FARM_WHEAT_GOTO_MS || '22000', 10);

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

function tillableGround(b) {
  if (!b) return false;
  return b.name === 'grass_block' || b.name === 'dirt' || b.name === 'dirt_path' || b.name === 'rooted_dirt';
}

function waterWithin(bot, center, radius) {
  const c = center;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = -2; dy <= 2; dy++) {
        const b = bot.blockAt(c.offset(dx, dy, dz));
        if (b && (b.name === 'water' || b.name === 'flowing_water')) return true;
      }
    }
  }
  return false;
}

function findHoe(bot) {
  return bot.inventory.items().find((i) =>
    /_hoe$/.test(i.name || ''));
}

function cropAge(block) {
  if (!block) return 0;
  if (block.state && typeof block.state.age === 'number') return block.state.age;
  if (typeof block.metadata === 'number') return block.metadata;
  return 0;
}

function isMatureWheat(b) {
  return b && b.name === 'wheat' && cropAge(b) >= 7;
}

async function runTillPlant(bot, state, params) {
  const hoe = findHoe(bot);
  if (!hoe) return { success: false, reason: 'Need a hoe (e.g. stone_hoe).' };
  if (countItems(bot, 'wheat_seeds') < 1) {
    return { success: false, reason: 'Need wheat seeds.' };
  }

  const maxDist = params.maxDistance ?? 32;
  const candidates = bot.findBlocks({
    point: bot.entity.position,
    maxDistance: maxDist,
    count: 64,
    matching: (b) => b && tillableGround(b) && waterWithin(bot, b.position, 5),
  });

  if (!candidates.length) {
    return { success: false, reason: 'No irrigable dirt/grass near water.' };
  }

  for (const pos of candidates) {
    const ground = bot.blockAt(pos);
    if (!ground || !tillableGround(ground)) continue;
    const above = bot.blockAt(pos.offset(0, 1, 0));
    if (!above || (above.name !== 'air' && above.name !== 'cave_air' && above.name !== 'void_air')) continue;

    try {
      await gotoTimeout(bot, new GoalGetToBlock(ground.position.x, ground.position.y, ground.position.z), GOTO_MS);
    } catch (e) {
      continue;
    }

    try {
      await bot.equip(hoe, 'hand');
      await bot.activateBlock(ground, new Vec3(0, 1, 0));
      await new Promise((r) => setTimeout(r, 280));
    } catch (e) {
      continue;
    }

    const farm = bot.blockAt(pos.offset(0, 1, 0));
    if (!farm || farm.name !== 'farmland') continue;

    const seeds = bot.inventory.items().find((i) => i.name === 'wheat_seeds');
    if (!seeds) return { success: false, reason: 'Lost wheat seeds before planting.' };

    try {
      await bot.equip(seeds, 'hand');
      await bot.placeBlock(farm, new Vec3(0, 1, 0));
    } catch (e) {
      continue;
    }

    return { success: true, reason: 'Tilled soil and planted wheat.' };
  }

  return { success: false, reason: 'Could not till and plant near water.' };
}

async function runHarvest(bot, state, params) {
  const want = Math.max(1, params.count ?? 3);
  const maxDist = params.maxDistance ?? 40;
  const before = countItems(bot, 'wheat');

  if (before >= want) {
    return { success: true, reason: `Already have ${before} wheat.` };
  }

  let tries = 0;
  while (countItems(bot, 'wheat') < want && tries < 40) {
    tries++;
    const block = bot.findBlock({
      point: bot.entity.position,
      maxDistance: maxDist,
      matching: isMatureWheat,
    });
    if (!block) {
      return {
        success: countItems(bot, 'wheat') >= want,
        reason: `No mature wheat nearby; have ${countItems(bot, 'wheat')} wheat.`,
      };
    }

    try {
      await gotoTimeout(bot, new GoalGetToBlock(block.position.x, block.position.y, block.position.z), GOTO_MS);
    } catch (e) {
      continue;
    }

    try {
      await bot.dig(block);
      await new Promise((r) => setTimeout(r, 220));
    } catch (e) { /* ignore */ }
  }

  const have = countItems(bot, 'wheat');
  return {
    success: have >= want,
    reason: have >= want ? `Harvested wheat (${have}).` : `Harvest partial: ${have}/${want} wheat.`,
  };
}

/**
 * Wheat farm steps. Dispatched by executor _taskId.
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };
  if (state?.blackboard?.regionProtected) {
    return { success: false, reason: 'Protected area.' };
  }

  const id = params._taskId;
  if (id === 'till_plant_wheat') return runTillPlant(bot, state, params);
  if (id === 'harvest_mature_wheat') return runHarvest(bot, state, params);
  return { success: false, reason: `farmWheat: unknown task ${id}.` };
}

module.exports = { run };
