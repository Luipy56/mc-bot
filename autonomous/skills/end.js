'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

/**
 * End-phase skills: craft_eyes_of_ender, find_stronghold, enter_end, kill_ender_dragon.
 */
async function runCraftEyes(bot, state, params) {
  const craftingSkill = require('./crafting');
  const need = params.count ?? 12;
  if (countItems(bot, 'ender_eye') >= need) return { success: true, reason: 'Enough eyes of ender.' };
  const blazes = countItems(bot, 'blaze_powder');
  const pearls = countItems(bot, 'ender_pearl');
  if (blazes < 1 || pearls < 1) return { success: false, reason: 'Need blaze powder and ender pearls.' };
  return craftingSkill.run(bot, state, { itemName: 'ender_eye', count: 1 });
}

async function runFindStronghold(bot, state, params) {
  let portal = bot.findBlock({ matching: (b) => b.name === 'end_portal_frame', maxDistance: 96 });
  if (portal) {
    try {
      const goal = new GoalGetToBlock(portal.position.x, portal.position.y, portal.position.z);
      await bot.pathfinder.goto(goal);
      return { success: true, reason: 'Reached stronghold portal frame.' };
    } catch (e) {
      return { success: false, reason: e.message || 'Could not reach stronghold.' };
    }
  }

  const eye = bot.inventory.items().find((i) => i.name === 'ender_eye');
  if (eye) {
    for (let t = 0; t < 6; t++) {
      try {
        await bot.equip(eye, 'hand');
        bot.activateItem();
        await new Promise((r) => setTimeout(r, 3500));
        bot.deactivateItem?.();
      } catch (e) { /* ignore */ }
      portal = bot.findBlock({ matching: (b) => b.name === 'end_portal_frame', maxDistance: 128 });
      if (portal) {
        try {
          const goal = new GoalGetToBlock(portal.position.x, portal.position.y, portal.position.z);
          await bot.pathfinder.goto(goal);
          return { success: true, reason: 'Found stronghold after using eyes.' };
        } catch (e) {
          return { success: false, reason: e.message || 'Could not reach frame.' };
        }
      }
    }
  }

  return { success: false, reason: 'Stronghold not found; walk toward eye direction or explore.' };
}

async function runEnterEnd(bot, state, params) {
  const portal = bot.findBlock({ matching: (b) => b.name === 'end_portal', maxDistance: 24 });
  if (!portal) return { success: false, reason: 'No active End portal nearby (fill frame with eyes).' };
  try {
    const goal = new GoalGetToBlock(portal.position.x, portal.position.y, portal.position.z);
    await bot.pathfinder.goto(goal);
    await bot.activateBlock(portal);
    await new Promise((r) => setTimeout(r, 4000));
    return { success: true, reason: 'Entered End dimension.' };
  } catch (e) {
    return { success: false, reason: e.message || 'Enter failed.' };
  }
}

async function runKillDragon(bot, state, params) {
  const { GoalFollow } = require('mineflayer-pathfinder').goals;
  const maxTicks = params.maxTicks ?? 120;
  let noDragonStreak = 0;

  for (let i = 0; i < maxTicks; i++) {
    const dragon = bot.nearestEntity((e) => e.name === 'ender_dragon');
    if (!dragon) {
      noDragonStreak++;
      if (noDragonStreak >= 15) {
        return { success: true, reason: 'Ender Dragon defeated or left loaded chunks (game may be complete).' };
      }
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    noDragonStreak = 0;
    try {
      bot.pathfinder.setGoal(new GoalFollow(dragon, 4), true);
      const p = dragon.position;
      const lookAt = p.offset ? p.offset(0, 2, 0) : { x: p.x, y: p.y + 2, z: p.z };
      await bot.lookAt(lookAt);
      await bot.attack(dragon);
    } catch (e) {
      try { bot.pathfinder.setGoal(null); } catch (e2) {}
    }
    await new Promise((r) => setTimeout(r, 450));
  }

  return { success: true, reason: 'Dragon combat phase finished (continue loop if dragon alive).' };
}

const runners = {
  craft_eyes_of_ender: runCraftEyes,
  find_stronghold: runFindStronghold,
  enter_end: runEnterEnd,
  kill_ender_dragon: runKillDragon,
};

async function run(bot, state, params) {
  const key = params._taskId || state._currentTaskId;
  const fn = runners[key];
  if (fn) return fn(bot, state, params);
  return { success: false, reason: 'Unknown end task.' };
}

module.exports = { run, runCraftEyes, runFindStronghold, runEnterEnd, runKillDragon };
