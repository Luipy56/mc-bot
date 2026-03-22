'use strict';

const { GoalFollow } = require('mineflayer-pathfinder').goals;
const { countItems, WOOL_NAMES } = require('../lib/inventoryQuery');

const SHEAR_TIMEOUT_MS = parseInt(process.env.SHEAR_SHEEP_TIMEOUT_MS || '32000', 10);
const FOLLOW_INTERVAL_MS = 160;
const AFTER_USE_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countWool(bot) {
  return countItems(bot, WOOL_NAMES);
}

function listSheepByDistance(bot, maxDistance) {
  const base = bot.entity.position;
  const out = [];
  for (const id of Object.keys(bot.entities || {})) {
    const e = bot.entities[id];
    if (!e || !e.isValid || e.name !== 'sheep' || !e.position) continue;
    const d = e.position.distanceTo(base);
    if (!Number.isFinite(d) || d > maxDistance) continue;
    out.push({ e, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.map((x) => x.e);
}

function isLikelyBabySheep(e) {
  if (!e) return false;
  if (e.isBaby === true) return true;
  if (typeof e.age === 'number' && e.age < 0) return true;
  return false;
}

async function useShearsOn(bot, shearsStack, target) {
  await bot.equip(shearsStack, 'hand');
  await bot.lookAt(target.position.offset(0, 1, 0), true);
  const r = bot.useOn(target);
  if (r && typeof r.then === 'function') await r;
}

/**
 * Equip shears and shear a nearby sheep for wool.
 * params: { maxDistance?: number, minWool?: number }
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };
  if (state?.blackboard?.regionProtected) {
    return { success: false, reason: 'Protected area; find sheep farther from spawn.' };
  }

  const shears = bot.inventory.items().find((i) => i.name === 'shears');
  if (!shears) return { success: false, reason: 'Need shears.' };

  const maxDistance = params.maxDistance ?? 40;
  const minWool = Math.max(1, params.minWool ?? 1);
  const before = countWool(bot);
  if (before >= minWool) {
    return { success: true, reason: 'Already have wool in inventory.' };
  }

  const started = Date.now();
  let sheepList = listSheepByDistance(bot, maxDistance).filter((e) => !isLikelyBabySheep(e));
  if (sheepList.length === 0) {
    sheepList = listSheepByDistance(bot, maxDistance);
  }
  if (sheepList.length === 0) {
    return { success: false, reason: 'No sheep nearby.' };
  }

  let idx = 0;
  while (Date.now() - started < SHEAR_TIMEOUT_MS) {
    if (countWool(bot) - before >= minWool) {
      try {
        bot.pathfinder.setGoal(null);
      } catch (e) { /* ignore */ }
      return { success: true, reason: 'Sheared a sheep and collected wool.' };
    }

    while (idx < sheepList.length && (!sheepList[idx] || !sheepList[idx].isValid)) idx++;
    if (idx >= sheepList.length) {
      sheepList = listSheepByDistance(bot, maxDistance).filter((e) => !isLikelyBabySheep(e));
      if (sheepList.length === 0) sheepList = listSheepByDistance(bot, maxDistance);
      idx = 0;
      if (sheepList.length === 0) break;
    }

    const target = sheepList[idx];
    const dist = target.position.distanceTo(bot.entity.position);

    try {
      bot.pathfinder.setGoal(new GoalFollow(target, 2.5), true);
    } catch (e) { /* ignore */ }

    if (dist <= 3.6) {
      const s = bot.inventory.items().find((i) => i.name === 'shears');
      if (!s) {
        try {
          bot.pathfinder.setGoal(null);
        } catch (e2) { /* ignore */ }
        return { success: false, reason: 'Lost shears before shearing.' };
      }
      try {
        await useShearsOn(bot, s, target);
      } catch (e) { /* try next attempt */ }
      await sleep(AFTER_USE_MS);
      if (countWool(bot) - before >= minWool) {
        try {
          bot.pathfinder.setGoal(null);
        } catch (e) { /* ignore */ }
        return { success: true, reason: 'Sheared a sheep and collected wool.' };
      }
      idx += 1;
    }

    await sleep(FOLLOW_INTERVAL_MS);
  }

  try {
    bot.pathfinder.setGoal(null);
  } catch (e) { /* ignore */ }

  if (countWool(bot) - before >= minWool) {
    return { success: true, reason: 'Sheared a sheep and collected wool.' };
  }
  return { success: false, reason: 'Could not shear a sheep in time (try exploring for pastures).' };
}

module.exports = { run, countWool };
