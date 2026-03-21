'use strict';

const Vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;
const { countItems, PLANK_NAMES } = require('../lib/inventoryQuery');
const { setBlackboard } = require('../lib/state');
const { PLANKS_NEEDED } = require('./craftHousePlanks');

const DEFAULT_PLANK_NAME = (process.env.HOUSE_PLANK_NAME || 'oak_planks').trim() || 'oak_planks';
const PLACE_TIMEOUT_MS = parseInt(process.env.HOUSE_PLACE_TIMEOUT_MS || '18000', 10);
const WIDTH = Math.max(2, parseInt(process.env.HOUSE_WIDTH || '6', 10));
const DEPTH = Math.max(2, parseInt(process.env.HOUSE_DEPTH || '6', 10));
const WALL_HEIGHT = Math.max(1, parseInt(process.env.HOUSE_WALL_HEIGHT || '2', 10));

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

function isSolid(block) {
  return Boolean(block && block.boundingBox === 'block');
}

function hasFoundationSupport(bot, bx, by, bz) {
  for (let dx = 0; dx < WIDTH; dx++) {
    for (let dz = 0; dz < DEPTH; dz++) {
      const below = bot.blockAt(new Vec3(bx + dx, by - 1, bz + dz));
      if (!isSolid(below)) return false;
    }
  }
  return true;
}

function findSupportedOrigin(bot, seedX, seedY, seedZ) {
  const yCandidates = [seedY, seedY - 1, seedY + 1, seedY - 2, seedY + 2];
  for (let radius = 0; radius <= 14; radius += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      for (let dz = -radius; dz <= radius; dz += 2) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const bx = seedX + dx;
        const bz = seedZ + dz;
        for (const by of yCandidates) {
          if (hasFoundationSupport(bot, bx, by, bz)) {
            return { x: bx, y: by, z: bz };
          }
        }
      }
    }
  }
  return null;
}

function resolveHousePlankName(bot, state, params = {}) {
  const preferred = params.plankName || state?.blackboard?.housePlankName || DEFAULT_PLANK_NAME;
  if (countItems(bot, preferred) > 0) return preferred;
  for (const name of PLANK_NAMES) {
    if (countItems(bot, name) > 0) return name;
  }
  return preferred;
}

async function placeOnePlank(bot, target, plankName) {
  const refPos = target.offset(0, -1, 0);
  const refBlock = bot.blockAt(refPos);
  if (!refBlock || refBlock.name === 'air' || refBlock.name === 'cave_air' || refBlock.name === 'void_air') {
    return { ok: false, reason: 'No solid block below target.' };
  }
  const item = bot.inventory.items().find((i) => i.name === plankName);
  if (!item) return { ok: false, reason: `No ${plankName} in inventory.` };

  const existing = bot.blockAt(target);
  if (existing && existing.name === plankName) return { ok: true, reason: 'Already placed.' };

  try {
    const goal = new GoalNear(refBlock.position.x, refBlock.position.y, refBlock.position.z, 2);
    await gotoPlaceTimeout(bot, goal, PLACE_TIMEOUT_MS);
  } catch (e) {
    return { ok: false, reason: 'Could not reach place spot.' };
  }

  try {
    await bot.equip(item, 'hand');
    await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
    return { ok: true, reason: 'Placed.' };
  } catch (err) {
    const after = bot.blockAt(target);
    if (after && after.name === plankName) {
      return { ok: true, reason: 'Placed (late block update).' };
    }
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
  const plankName = resolveHousePlankName(bot, state, params);
  setBlackboard(state, 'housePlankName', plankName);

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

  if (!hasFoundationSupport(bot, bx, by, bz)) {
    const p = bot.entity.position.floored();
    const relocated = findSupportedOrigin(bot, p.x + 2, p.y, p.z + 2) || findSupportedOrigin(bot, bx, by, bz);
    if (relocated) {
      bx = relocated.x;
      by = relocated.y;
      bz = relocated.z;
      setBlackboard(state, 'houseOrigin', { x: bx, y: by, z: bz });
    }
  }

  const positions = buildPositionList(bx, by, bz);
  let existingPlaced = 0;
  for (const target of positions) {
    const existing = bot.blockAt(target);
    if (existing && existing.name === plankName) existingPlaced++;
  }
  const requiredInInventory = Math.max(0, need - existingPlaced);
  const available = countItems(bot, plankName);
  if (available < requiredInInventory) {
    return {
      success: false,
      reason: `Need ${requiredInInventory} more ${plankName} for remaining house blocks; have ${available}.`,
    };
  }

  let placed = 0;
  let skipped = 0;

  for (const target of positions) {
    const existing = bot.blockAt(target);
    if (existing && existing.name === plankName) {
      skipped++;
      continue;
    }
    const r = await placeOnePlank(bot, target, plankName);
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
    reason: `Wooden house built with ${plankName} at (${bx},${by},${bz}): ${placed} placed, ${skipped} already there.`,
  };
}

module.exports = { run, buildPositionList, WIDTH, DEPTH, WALL_HEIGHT };
