'use strict';

const { GoalFollow } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

const MILK_TIMEOUT_MS = parseInt(process.env.MILK_COW_TIMEOUT_MS || '28000', 10);
const TICK_MS = 180;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nearestCow(bot, maxDistance) {
  const base = bot.entity.position;
  let best = null;
  let bestD = Infinity;
  for (const id of Object.keys(bot.entities || {})) {
    const e = bot.entities[id];
    if (!e || !e.isValid || e.name !== 'cow' || !e.position) continue;
    const d = e.position.distanceTo(base);
    if (!Number.isFinite(d) || d > maxDistance) continue;
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/**
 * Fill empty bucket with milk from a cow. params: { maxDistance?: number }
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };
  if (state?.blackboard?.regionProtected) {
    return { success: false, reason: 'Protected area; find cows outside spawn.' };
  }

  if (countItems(bot, 'milk_bucket') >= 1) {
    return { success: true, reason: 'Already have a milk bucket.' };
  }

  const bucket = bot.inventory.items().find((i) => i.name === 'bucket');
  if (!bucket) return { success: false, reason: 'Need an empty iron bucket.' };

  const maxDistance = params.maxDistance ?? 40;
  const started = Date.now();
  let target = nearestCow(bot, maxDistance);
  if (!target) return { success: false, reason: 'No cow nearby.' };

  while (Date.now() - started < MILK_TIMEOUT_MS) {
    if (countItems(bot, 'milk_bucket') >= 1) {
      try {
        bot.pathfinder.setGoal(null);
      } catch (e) { /* ignore */ }
      return { success: true, reason: 'Milked a cow.' };
    }

    if (!target.isValid) {
      target = nearestCow(bot, maxDistance);
      if (!target) break;
    }

    const dist = target.position.distanceTo(bot.entity.position);
    try {
      bot.pathfinder.setGoal(new GoalFollow(target, 2.2), true);
    } catch (e) { /* ignore */ }

    if (dist <= 3.5) {
      const b = bot.inventory.items().find((i) => i.name === 'bucket');
      if (!b) {
        try {
          bot.pathfinder.setGoal(null);
        } catch (e2) { /* ignore */ }
        return { success: false, reason: 'Lost empty bucket.' };
      }
      try {
        await bot.equip(b, 'hand');
        await bot.lookAt(target.position.offset(0, 1.2, 0), true);
        const r = bot.useOn(target);
        if (r && typeof r.then === 'function') await r;
      } catch (e) { /* ignore */ }
      await sleep(400);
    }

    await sleep(TICK_MS);
  }

  try {
    bot.pathfinder.setGoal(null);
  } catch (e) { /* ignore */ }

  if (countItems(bot, 'milk_bucket') >= 1) {
    return { success: true, reason: 'Milked a cow.' };
  }
  return { success: false, reason: 'Could not milk a cow in time.' };
}

module.exports = { run };
