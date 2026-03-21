'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;

/**
 * Nether-phase skills: build_nether_portal, enter_nether, collect_blaze_rods, collect_ender_pearls.
 * Dispatches by state or params; each returns { success, reason }.
 */
async function runBuildPortal(bot, state, params) {
  let portalBlock = bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 48 });
  if (portalBlock) {
    try {
      const goal = new GoalGetToBlock(portalBlock.position.x, portalBlock.position.y, portalBlock.position.z);
      await bot.pathfinder.goto(goal);
      return { success: true, reason: 'Reached existing Nether portal.' };
    } catch (e) {
      return { success: false, reason: e.message || 'Could not reach portal.' };
    }
  }

  const flintItem = bot.inventory.items().find((i) => i.name === 'flint_and_steel');
  if (flintItem) {
    const obs = bot.findBlock({ matching: (b) => b.name === 'obsidian', maxDistance: 12 });
    if (obs) {
      try {
        const goal = new GoalGetToBlock(obs.position.x, obs.position.y, obs.position.z);
        await bot.pathfinder.goto(goal);
        await bot.equip(flintItem, 'hand');
        await bot.activateBlock(obs);
        await new Promise((r) => setTimeout(r, 2000));
        portalBlock = bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 8 });
        if (portalBlock) return { success: true, reason: 'Lit Nether portal with flint & steel.' };
      } catch (e) {
        return { success: false, reason: e.message || 'Could not light portal.' };
      }
    }
  }
  return { success: false, reason: 'Need obsidian frame + flint & steel, or existing portal.' };
}

async function runEnterNether(bot, state, params) {
  const portalBlock = bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 16 });
  if (!portalBlock) return { success: false, reason: 'No portal nearby.' };
  try {
    const goal = new GoalGetToBlock(portalBlock.position.x, portalBlock.position.y, portalBlock.position.z);
    await bot.pathfinder.goto(goal);
    await bot.activateBlock(portalBlock);
    return { success: true, reason: 'Entered Nether.' };
  } catch (e) {
    return { success: false, reason: e.message || 'Enter failed.' };
  }
}

async function runCollectBlazeRods(bot, state, params) {
  const { countItems } = require('../lib/inventoryQuery');
  const need = params.count ?? 6;
  if (countItems(bot, 'blaze_rod') >= need) return { success: true, reason: 'Enough blaze rods.' };
  const blaze = bot.nearestEntity((e) => e.name === 'blaze' && e.position.distanceTo(bot.entity.position) < 24);
  if (!blaze) return { success: false, reason: 'No blaze nearby (need Nether fortress).' };
  try {
    const { GoalFollow } = require('mineflayer-pathfinder').goals;
    bot.pathfinder.setGoal(new GoalFollow(blaze, 2), true);
    await bot.attack(blaze);
    return { success: countItems(bot, 'blaze_rod') >= need, reason: 'Attacked blaze.' };
  } catch (e) {
    bot.pathfinder.setGoal(null);
    return { success: false, reason: e.message || 'Attack failed.' };
  }
}

async function runCollectEnderPearls(bot, state, params) {
  const { countItems } = require('../lib/inventoryQuery');
  const need = params.count ?? 12;
  if (countItems(bot, 'ender_pearl') >= need) return { success: true, reason: 'Enough ender pearls.' };
  const enderman = bot.nearestEntity((e) => e.name === 'enderman' && e.position.distanceTo(bot.entity.position) < 24);
  if (!enderman) return { success: false, reason: 'No enderman nearby.' };
  try {
    const { GoalFollow } = require('mineflayer-pathfinder').goals;
    bot.pathfinder.setGoal(new GoalFollow(enderman, 2), true);
    await bot.attack(enderman);
    return { success: countItems(bot, 'ender_pearl') >= need, reason: 'Attacked enderman.' };
  } catch (e) {
    bot.pathfinder.setGoal(null);
    return { success: false, reason: e.message || 'Attack failed.' };
  }
}

const runners = {
  build_nether_portal: runBuildPortal,
  enter_nether: runEnterNether,
  collect_blaze_rods: runCollectBlazeRods,
  collect_ender_pearls: runCollectEnderPearls,
};

async function run(bot, state, params) {
  const key = params._taskId || state._currentTaskId;
  const fn = runners[key];
  if (fn) return fn(bot, state, params);
  return { success: false, reason: 'Unknown nether task.' };
}

module.exports = { run, runBuildPortal, runEnterNether, runCollectBlazeRods, runCollectEnderPearls };
