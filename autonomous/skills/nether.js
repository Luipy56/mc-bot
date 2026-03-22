'use strict';

const { GoalGetToBlock, GoalNear } = require('mineflayer-pathfinder').goals;
const { setBlackboard } = require('../lib/state');
const { buildAndLightMinimalPortal } = require('../lib/netherPortal');
const { isInNether } = require('../lib/dimension');

const BLAZE_ATTACK_TICKS = parseInt(process.env.BLAZE_ATTACK_TICKS || '8', 10);
const ENDERMAN_ATTACK_TICKS = parseInt(process.env.ENDERMAN_ATTACK_TICKS || '6', 10);

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
      setBlackboard(state, 'netherPortalPos', {
        x: portalBlock.position.x,
        y: portalBlock.position.y,
        z: portalBlock.position.z,
      });
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
        if (portalBlock) {
          setBlackboard(state, 'netherPortalPos', {
            x: portalBlock.position.x,
            y: portalBlock.position.y,
            z: portalBlock.position.z,
          });
          return { success: true, reason: 'Lit Nether portal with flint & steel.' };
        }
      } catch (e) {
        return { success: false, reason: e.message || 'Could not light portal.' };
      }
    }
  }

  const built = await buildAndLightMinimalPortal(bot);
  if (built.ok) {
    portalBlock = bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 16 });
    if (portalBlock) {
      setBlackboard(state, 'netherPortalPos', {
        x: portalBlock.position.x,
        y: portalBlock.position.y,
        z: portalBlock.position.z,
      });
    }
    return { success: true, reason: built.reason };
  }
  return { success: false, reason: built.reason || 'Need obsidian frame + flint & steel, or existing portal.' };
}

async function runEnterNether(bot, state, params) {
  if (isInNether(bot)) {
    return { success: true, reason: 'Already in the Nether.' };
  }
  const saved = state.blackboard?.netherPortalPos;
  let portalBlock = bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 16 });
  if (!portalBlock && saved) {
    try {
      const goal = new GoalNear(saved.x, saved.y, saved.z, 3);
      await bot.pathfinder.goto(goal);
      portalBlock = bot.findBlock({ matching: (b) => b.name === 'nether_portal', maxDistance: 12 });
    } catch (e) { /* try local find */ }
  }
  if (!portalBlock) return { success: false, reason: 'No portal nearby.' };
  try {
    const goal = new GoalGetToBlock(portalBlock.position.x, portalBlock.position.y, portalBlock.position.z);
    await bot.pathfinder.goto(goal);
    await bot.activateBlock(portalBlock);
    const deadline = Date.now() + 14000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 450));
      if (isInNether(bot)) {
        return { success: true, reason: 'Entered Nether.' };
      }
    }
    if (isInNether(bot)) return { success: true, reason: 'Entered Nether.' };
    return { success: false, reason: 'Portal used but dimension did not change to the Nether.' };
  } catch (e) {
    return { success: false, reason: e.message || 'Enter failed.' };
  }
}

async function runCollectBlazeRods(bot, state, params) {
  const { countItems } = require('../lib/inventoryQuery');
  const { GoalFollow } = require('mineflayer-pathfinder').goals;
  const need = params.count ?? 6;
  if (countItems(bot, 'blaze_rod') >= need) return { success: true, reason: 'Enough blaze rods.' };

  const blaze = bot.nearestEntity((e) => e.name === 'blaze' && e.position.distanceTo(bot.entity.position) < 40);
  if (!blaze) {
    const netherrack = bot.findBlock({ matching: (b) => b.name === 'netherrack', maxDistance: 32 });
    if (netherrack) {
      setBlackboard(state, 'netherFortressHint', {
        x: netherrack.position.x,
        y: netherrack.position.y,
        z: netherrack.position.z,
        note: 'no_blaze_loaded',
      });
    }
    return { success: false, reason: 'No blaze nearby (search Nether fortress / bridge).' };
  }

  setBlackboard(state, 'netherFortressHint', {
    x: Math.floor(blaze.position.x),
    y: Math.floor(blaze.position.y),
    z: Math.floor(blaze.position.z),
    note: 'blaze_seen',
  });

  try {
    bot.pathfinder.setGoal(new GoalFollow(blaze, 3.2), true);
    for (let t = 0; t < BLAZE_ATTACK_TICKS; t++) {
      const b = bot.nearestEntity((e) => e.name === 'blaze' && e.position.distanceTo(bot.entity.position) < 40);
      if (!b) break;
      try {
        const p = b.position;
        const lookAt = p.offset ? p.offset(0, 1.2, 0) : { x: p.x, y: p.y + 1.2, z: p.z };
        await bot.lookAt(lookAt);
        await bot.attack(b);
      } catch (e) { /* continue */ }
      await new Promise((r) => setTimeout(r, 350));
      if (countItems(bot, 'blaze_rod') >= need) break;
    }
    bot.pathfinder.setGoal(null);
    return {
      success: countItems(bot, 'blaze_rod') >= need,
      reason: countItems(bot, 'blaze_rod') >= need ? 'Enough blaze rods.' : 'Need more blaze rods; stay near spawner.',
    };
  } catch (e) {
    try { bot.pathfinder.setGoal(null); } catch (e2) {}
    return { success: false, reason: e.message || 'Attack failed.' };
  }
}

async function runCollectEnderPearls(bot, state, params) {
  const { countItems } = require('../lib/inventoryQuery');
  const { GoalFollow } = require('mineflayer-pathfinder').goals;
  const need = params.count ?? 12;
  if (countItems(bot, 'ender_pearl') >= need) return { success: true, reason: 'Enough ender pearls.' };

  const enderman = bot.nearestEntity((e) => e.name === 'enderman' && e.position.distanceTo(bot.entity.position) < 36);
  if (!enderman) {
    return { success: false, reason: 'No enderman nearby (try Warped forest / wide platform).' };
  }

  try {
    bot.pathfinder.setGoal(new GoalFollow(enderman, 2.8), true);
    for (let t = 0; t < ENDERMAN_ATTACK_TICKS; t++) {
      const e = bot.nearestEntity((en) => en.name === 'enderman' && en.position.distanceTo(bot.entity.position) < 36);
      if (!e) break;
      try {
        const p = e.position;
        const lookAt = p.offset ? p.offset(0, 1.4, 0) : { x: p.x, y: p.y + 1.4, z: p.z };
        await bot.lookAt(lookAt);
        await bot.attack(e);
      } catch (err) { /* continue */ }
      await new Promise((r) => setTimeout(r, 400));
      if (countItems(bot, 'ender_pearl') >= need) break;
    }
    bot.pathfinder.setGoal(null);
    return {
      success: countItems(bot, 'ender_pearl') >= need,
      reason: countItems(bot, 'ender_pearl') >= need ? 'Enough ender pearls.' : 'Farming endermen.',
    };
  } catch (e) {
    try { bot.pathfinder.setGoal(null); } catch (e2) {}
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
