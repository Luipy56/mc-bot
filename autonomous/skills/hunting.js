'use strict';

const { GoalFollow } = require('mineflayer-pathfinder').goals;
const { countItemsByNames, MEAT_NAMES, PASSIVE_FOOD_MOBS, findBestFoodItem } = require('../lib/food');

const HUNT_TIMEOUT_MS = parseInt(process.env.HUNT_TIMEOUT_MS || '30000', 10);
const HUNT_ATTACK_INTERVAL_MS = parseInt(process.env.HUNT_ATTACK_INTERVAL_MS || '700', 10);
const HUNT_PICKUP_WAIT_MS = parseInt(process.env.HUNT_PICKUP_WAIT_MS || '1800', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nearestPassiveFood(bot, names, maxDistance) {
  if (!bot || !bot.entity || !bot.entities) return null;
  const allowed = new Set(names);
  const base = bot.entity.position;
  let best = null;
  let bestDist = Infinity;
  for (const id of Object.keys(bot.entities)) {
    const e = bot.entities[id];
    if (!e || !e.position || !e.name || !e.isValid) continue;
    if (!allowed.has(e.name)) continue;
    const dist = e.position.distanceTo(base);
    if (!Number.isFinite(dist) || dist > maxDistance) continue;
    if (dist < bestDist) {
      best = e;
      bestDist = dist;
    }
  }
  return best;
}

async function tryEatIfHungry(bot, eatBelow) {
  if (!bot || bot.food == null || bot.food >= eatBelow) return false;
  const food = findBestFoodItem(bot);
  if (!food) return false;
  try {
    await bot.equip(food, 'hand');
    await bot.consume();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Hunt passive mobs for meat and optionally eat afterward.
 * params: { maxDistance?, minMeat?, mobNames?, eatBelow? }.
 */
async function run(bot, state, params = {}) {
  if (!bot || !bot.entity || !bot.pathfinder) {
    return { success: false, reason: 'No bot entity/pathfinder.' };
  }
  if (state?.blackboard?.regionProtected) {
    return { success: false, reason: 'Protected area blocks hunting; explore farther first.' };
  }

  const maxDistance = params.maxDistance ?? 34;
  const minMeat = params.minMeat ?? 1;
  const eatBelow = params.eatBelow ?? 15;
  const mobNames = Array.isArray(params.mobNames) && params.mobNames.length ? params.mobNames : PASSIVE_FOOD_MOBS;

  const before = countItemsByNames(bot, MEAT_NAMES);
  const started = Date.now();
  let target = nearestPassiveFood(bot, mobNames, maxDistance);
  if (!target) return { success: false, reason: `No passive food mobs nearby (${mobNames.join(', ')}).` };

  while (Date.now() - started < HUNT_TIMEOUT_MS) {
    if (!target || !target.isValid) {
      target = nearestPassiveFood(bot, mobNames, maxDistance);
      if (!target) break;
    }

    const dist = target.position.distanceTo(bot.entity.position);
    try { bot.pathfinder.setGoal(new GoalFollow(target, 2), true); } catch (e) {}

    if (dist <= 3.3) {
      try { await bot.lookAt(target.position.offset(0, 1.0, 0), true); } catch (e) {}
      try { await bot.attack(target); } catch (e) {}
      await sleep(HUNT_ATTACK_INTERVAL_MS);
    } else {
      await sleep(180);
    }
  }

  try { bot.pathfinder.setGoal(null); } catch (e) {}
  await sleep(HUNT_PICKUP_WAIT_MS);

  const after = countItemsByNames(bot, MEAT_NAMES);
  const gained = after - before;
  const ate = await tryEatIfHungry(bot, eatBelow);
  if (gained >= minMeat) {
    return { success: true, reason: ate ? `Hunted food (+${gained}) and ate.` : `Hunted food (+${gained}).` };
  }
  if (after > 0 || ate) {
    return { success: true, reason: ate ? 'Ate available food after hunting.' : 'Food already available after hunt.' };
  }
  return { success: false, reason: 'Hunt finished with no meat collected.' };
}

module.exports = { run };
