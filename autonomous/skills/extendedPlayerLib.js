'use strict';

const { GoalGetToBlock, GoalFollow } = require('mineflayer-pathfinder').goals;

const GOTO_MS = parseInt(process.env.EXTENDED_PLAYER_GOTO_MS || '22000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function nearestEntityByNames(bot, names, maxDist) {
  const set = new Set(names);
  const base = bot.entity?.position;
  if (!base) return null;
  let best = null;
  let bestD = Infinity;
  for (const e of Object.values(bot.entities || {})) {
    if (!e || !e.position || !e.isValid) continue;
    if (!set.has(e.name)) continue;
    const d = e.position.distanceTo(base);
    if (Number.isFinite(d) && d < bestD && d <= maxDist) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function nearestPassiveForBreed(bot, maxDist) {
  const names = ['cow', 'sheep', 'mooshroom'];
  return nearestEntityByNames(bot, names, maxDist);
}

function isLogBlock(name) {
  if (!name) return false;
  return name.endsWith('_log') || name === 'log' || name.endsWith('_wood');
}

function partial(reason) {
  return { success: false, reason };
}

async function openFurnaceCookOnce(bot, blockPred, foodNames, fuelNames) {
  const block = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 28,
    matching: blockPred,
  });
  if (!block) return partial('No matching furnace block nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(block.position.x, block.position.y, block.position.z), GOTO_MS);
  } catch (e) {
    return partial('Could not reach furnace-like block.');
  }
  let furnace;
  try {
    furnace = await bot.openFurnace(block);
  } catch (e) {
    return partial(e.message || 'openFurnace failed.');
  }
  try {
    const inv = bot.inventory.items();
    const food = inv.find((i) => foodNames.includes(i.name));
    const fuel = inv.find((i) => fuelNames.includes(i.name));
    if (!food || !fuel) {
      return partial(`Need input (${foodNames.join('/')}) and fuel (${fuelNames.join('/')}).`);
    }
    await furnace.putInput(food.type, food.metadata ?? null, 1);
    await furnace.putFuel(fuel.type, fuel.metadata ?? null, Math.min(4, fuel.count));
    await sleep(9000);
    const out = furnace.outputItem();
    if (out) await furnace.takeOutput();
  } finally {
    try {
      await bot.closeWindow(furnace);
    } catch (e) { /* ignore */ }
  }
  return { success: true, reason: 'Started one cook/smelt cycle in furnace-like block.' };
}

module.exports = {
  sleep,
  gotoTimeout,
  GOTO_MS,
  nearestEntityByNames,
  nearestPassiveForBreed,
  isLogBlock,
  partial,
  openFurnaceCookOnce,
};
