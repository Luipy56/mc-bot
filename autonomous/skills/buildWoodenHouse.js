'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');
const { setBlackboard } = require('../lib/state');
const { PLANKS_NEEDED } = require('./craftHousePlanks');

const PLANK_NAME = 'oak_planks';
const PLACE_TIMEOUT_MS = parseInt(process.env.HOUSE_PLACE_TIMEOUT_MS || '18000', 10);
const WIDTH = 6;
const DEPTH = 6;
const WALL_HEIGHT = 2;

function gotoPlaceTimeout(bot, goal, ms) {
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

/**
 * Build positions: floor, hollow walls, flat roof (all oak_planks).
 * Origin is the corner (min x, min z) at floor level.
 */
function buildPositionList(bx, by, bz) {
  const list = [];
  for (let dx = 0; dx < WIDTH; dx++) {
    for (let dz = 0; dz < DEPTH; dz++) {
      list.push(new Vec3(bx + dx, by, bz + dz));
    }
  }
  for (let h = 1; h <= WALL_HEIGHT; h++) {
    for (let dx = 0; dx < WIDTH; dx++) {
      for (let dz = 0; dz < DEPTH; dz++) {
        const onPerimeter = dx === 0 || dx === WIDTH - 1 || dz === 0 || dz === DEPTH - 1;
        if (onPerimeter) list.push(new Vec3(bx + dx, by + h, bz + dz));
      }
    }
  }
  const roofY = by + WALL_HEIGHT + 1;
  for (let dx = 0; dx < WIDTH; dx++) {
    for (let dz = 0; dz < DEPTH; dz++) {
      list.push(new Vec3(bx + dx, roofY, bz + dz));
    }
  }
  return list;
}

async function placeOnePlank(bot, target) {
  const refPos = target.offset(0, -1, 0);
  const refBlock = bot.blockAt(refPos);
  if (!refBlock || refBlock.name === 'air' || refBlock.name === 'cave_air' || refBlock.name === 'void_air') {
    return { ok: false, reason: 'No solid block below target.' };
  }
  const item = bot.inventory.items().find((i) => i.name === PLANK_NAME);
  if (!item) return { ok: false, reason: 'No oak_planks in inventory.' };

  const existing = bot.blockAt(target);
  if (existing && existing.name === PLANK_NAME) return { ok: true, reason: 'Already placed.' };

  try {
    const goal = new GoalGetToBlock(refBlock.position.x, refBlock.position.y, refBlock.position.z);
    await gotoPlaceTimeout(bot, goal, PLACE_TIMEOUT_MS);
  } catch (e) {
    return { ok: false, reason: 'Could not reach place spot.' };
  }

  try {
    await bot.equip(item, 'hand');
    await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
    return { ok: true, reason: 'Placed.' };
  } catch (err) {
    return { ok: false, reason: err.message || 'placeBlock failed.' };
  }
}

/**
 * Build a simple wooden house from scratch (floor + walls + roof).
 * Uses blackboard.houseOrigin {x,y,z} or spawnPos + offset.
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };

  const need = Math.max(1, params.minPlanks ?? PLANKS_NEEDED);
  if (countItems(bot, PLANK_NAME) < need) {
    return {
      success: false,
      reason: `Need at least ${need} ${PLANK_NAME}; have ${countItems(bot, PLANK_NAME)}.`,
    };
  }

  const sp = state?.blackboard?.spawnPos;
  let bx = params.originX;
  let by = params.originY;
  let bz = params.originZ;
  if (bx == null || by == null || bz == null) {
    const ho = state?.blackboard?.houseOrigin;
    if (ho && ho.x != null && ho.y != null && ho.z != null) {
      bx = ho.x;
      by = ho.y;
      bz = ho.z;
    } else if (sp) {
      bx = sp.x + 4;
      by = sp.y;
      bz = sp.z + 4;
      setBlackboard(state, 'houseOrigin', { x: bx, y: by, z: bz });
    } else {
      const p = bot.entity.position;
      bx = Math.floor(p.x) + 3;
      by = Math.floor(p.y);
      bz = Math.floor(p.z) + 3;
      setBlackboard(state, 'houseOrigin', { x: bx, y: by, z: bz });
    }
  }

  const positions = buildPositionList(bx, by, bz);
  let placed = 0;
  let skipped = 0;

  for (const target of positions) {
    const existing = bot.blockAt(target);
    if (existing && existing.name === PLANK_NAME) {
      skipped++;
      continue;
    }
    const r = await placeOnePlank(bot, target);
    if (!r.ok) {
      return {
        success: false,
        reason: `House incomplete at (${target.x},${target.y},${target.z}): ${r.reason} (${placed} placed, ${skipped} skipped).`,
      };
    }
    placed++;
  }

  return {
    success: true,
    reason: `Wooden house built at (${bx},${by},${bz}): ${placed} placed, ${skipped} already there.`,
  };
}

module.exports = { run, buildPositionList, WIDTH, DEPTH, WALL_HEIGHT };
