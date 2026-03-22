'use strict';

const Vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;

/**
 * Minimal Nether portal (10 obsidian, corners omitted). Local grid: u in [0..4] width, v in [0..3] height.
 * Interior air is 2x3 between the vertical pillars.
 */
const MINIMAL_PORTAL_SLOTS = [
  [1, 0], [2, 0], [3, 0],
  [0, 1], [0, 2],
  [4, 1], [4, 2],
  [1, 3], [2, 3], [3, 3],
];

function floorVec3(p) {
  return new Vec3(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
}

/**
 * Bottom-left corner P0 of the 5x4 frame grid in world space (u=0,v=0), portal plane perpendicular to forward.
 */
function snapYawCardinal(yaw) {
  const q = Math.PI / 2;
  return Math.round(yaw / q) * q;
}

function portalOriginFromBot(bot) {
  const yaw = snapYawCardinal(bot.entity.yaw);
  const fx = -Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = Math.sin(yaw);
  const foot = floorVec3(bot.entity.position);
  const forward = new Vec3(fx, 0, fz);
  const right = new Vec3(rx, 0, rz);
  const center = foot.plus(forward.scaled(2.5));
  const p0 = floorVec3(center.minus(right.scaled(2)));
  return { p0, right, forward };
}

function slotToWorld(p0, right, u, v) {
  return floorVec3(
    new Vec3(p0.x + Math.round(right.x * u), p0.y + v, p0.z + Math.round(right.z * u))
  );
}

function allPortalPositions(bot) {
  const { p0, right } = portalOriginFromBot(bot);
  return MINIMAL_PORTAL_SLOTS.map(([u, v]) => slotToWorld(p0, right, u, v));
}

function isAirLike(name) {
  return name === 'air' || name === 'cave_air' || name === 'void_air';
}

/**
 * True if we can stand in front of obsidian at `facePos` (block coords) and click the face toward `interior`.
 */
function ignitionContext(bot, framePositions) {
  const set = new Set(framePositions.map((p) => `${p.x},${p.y},${p.z}`));
  for (const p of framePositions) {
    for (const dir of [
      new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1),
    ]) {
      const inner = p.plus(dir);
      const key = `${inner.x},${inner.y},${inner.z}`;
      if (set.has(key)) continue;
      const innerBlock = bot.blockAt(inner);
      if (innerBlock && isAirLike(innerBlock.name)) {
        return { obsidianPos: p, standNear: inner, faceDir: dir };
      }
    }
  }
  return null;
}

async function placeObsidianAt(bot, pos) {
  const existing = bot.blockAt(pos);
  if (existing && existing.name === 'obsidian') return true;

  const item = bot.inventory.items().find((i) => i.name === 'obsidian');
  if (!item) return false;

  const below = pos.offset(0, -1, 0);
  let ref = bot.blockAt(below);
  if (!ref || isAirLike(ref.name)) {
    for (const d of [new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)]) {
      const side = pos.plus(d);
      const neighbor = bot.blockAt(side);
      if (neighbor && !isAirLike(neighbor.name)) {
        ref = neighbor;
        try {
          const goal = new GoalNear(pos.x, pos.y, pos.z, 2);
          await bot.pathfinder.goto(goal);
        } catch (e) {
          return false;
        }
        try {
          await bot.equip(item, 'hand');
          await bot.placeBlock(ref, d.scaled(-1));
          return bot.blockAt(pos)?.name === 'obsidian';
        } catch (e) {
          return false;
        }
      }
    }
    return false;
  }

  try {
    const goal = new GoalNear(below.x, below.y, below.z, 2);
    await bot.pathfinder.goto(goal);
  } catch (e) {
    return false;
  }
  try {
    await bot.equip(item, 'hand');
    await bot.placeBlock(ref, new Vec3(0, 1, 0));
    return bot.blockAt(pos)?.name === 'obsidian';
  } catch (e) {
    return false;
  }
}

async function ignitePortal(bot, framePositions) {
  const ctx = ignitionContext(bot, framePositions);
  if (!ctx) return false;
  const flint = bot.inventory.items().find((i) => i.name === 'flint_and_steel');
  if (!flint) return false;

  const stand = ctx.standNear;
  const obs = bot.blockAt(ctx.obsidianPos);
  if (!obs || obs.name !== 'obsidian') return false;

  try {
    const goal = new GoalNear(stand.x, stand.y, stand.z, 1.5);
    await bot.pathfinder.goto(goal);
  } catch (e) {
    return false;
  }

  try {
    await bot.equip(flint, 'hand');
    const look = obs.position.offset(0.5, 0.5, 0.5).plus(ctx.faceDir.scaled(-0.4));
    await bot.lookAt(look);
    await bot.activateBlock(obs);
    await new Promise((r) => setTimeout(r, 2200));
  } catch (e) {
    return false;
  }

  return Boolean(bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 8 }));
}

/**
 * Build a minimal obsidian portal in front of the bot and light it.
 * Tries up to four horizontal facings if the first orientation cannot place (no support / obstructed).
 */
async function buildAndLightMinimalPortal(bot) {
  const { countItems } = require('./inventoryQuery');
  if (countItems(bot, 'obsidian') < 10) {
    return { ok: false, reason: 'Need at least 10 obsidian for minimal portal.' };
  }

  let portal = bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 48 });
  if (portal) return { ok: true, reason: 'Nether portal already present.' };

  const pitch = bot.entity.pitch || 0;
  const baseYaw = bot.entity.yaw;
  const yawOffsets = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const seenYaw = new Set();
  let lastReason = 'Could not build Nether portal.';

  for (let attempt = 0; attempt < yawOffsets.length; attempt++) {
    const yaw = snapYawCardinal(baseYaw + yawOffsets[attempt]);
    const yawKey = yaw.toFixed(5);
    if (seenYaw.has(yawKey)) continue;
    seenYaw.add(yawKey);
    try {
      await bot.look(yaw, pitch, true);
      await new Promise((r) => setTimeout(r, 180));
    } catch (e) { /* continue */ }

    const positions = allPortalPositions(bot);
    let placedAny = false;
    let failPos = null;

    for (const pos of positions) {
      const countBefore = countItems(bot, 'obsidian');
      const placed = await placeObsidianAt(bot, pos);
      const countAfter = countItems(bot, 'obsidian');
      if (countAfter < countBefore) placedAny = true;
      if (!placed) {
        failPos = pos;
        break;
      }
    }

    if (failPos) {
      lastReason = `Could not place obsidian at ${failPos.x},${failPos.y},${failPos.z}.`;
      if (!placedAny) continue;
      return { ok: false, reason: lastReason };
    }

    const lit = await ignitePortal(bot, positions);
    if (lit) return { ok: true, reason: 'Built and lit minimal Nether portal.' };
    lastReason = 'Placed frame but failed to ignite (flint & steel / space).';
    if (placedAny) return { ok: false, reason: lastReason };
  }

  return { ok: false, reason: lastReason };
}

module.exports = {
  MINIMAL_PORTAL_SLOTS,
  allPortalPositions,
  buildAndLightMinimalPortal,
  portalOriginFromBot,
  slotToWorld,
};
