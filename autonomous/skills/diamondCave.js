'use strict';

/**
 * Find and mine diamond ore in caves / deepslate (1.18+).
 * Descends when too high and no ore is visible; uses wide search radius.
 */

const Vec3 = require('vec3');
const { GoalGetToBlock, GoalNear } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');
const { setBlackboard } = require('../lib/state');

const GOTO_MS = parseInt(process.env.MINING_GOTO_TIMEOUT_MS || '25000', 10);
const MAX_SEARCH_DIST = parseInt(process.env.DIAMOND_CAVE_SEARCH_DIST || '96', 10);
/** Prefer being at or below this Y to search (deepslate / lower caves). */
const TARGET_DEPTH_Y = parseInt(process.env.DIAMOND_CAVE_TARGET_Y || '-32', 10);
/** If Y is above this and no ore, try to go deeper. */
const NEED_DESCENT_ABOVE_Y = parseInt(process.env.DIAMOND_CAVE_NEED_DESCENT_ABOVE_Y || '48', 10);

const SEARCH_NAMES = ['diamond_ore', 'deepslate_diamond_ore'];
const ITEM_NAMES = ['diamond'];

function gotoWithTimeout(bot, goal, ms) {
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

function isFluid(name) {
  return name === 'lava' || name === 'flowing_lava' || name === 'water' || name === 'flowing_water';
}

async function equipBestPick(bot) {
  const order = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
  for (const n of order) {
    const it = bot.inventory.items().find((i) => i.name === n);
    if (it) {
      await bot.equip(it, 'hand');
      return true;
    }
  }
  return false;
}

/**
 * Pathfind deeper or mine one block under feet (stair down) if safe.
 */
async function tryDescend(bot, state) {
  const p = bot.entity.position;
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  const z = Math.floor(p.z);

  if (y <= NEED_DESCENT_ABOVE_Y) return false;

  const targetY = Math.max(TARGET_DEPTH_Y, y - 12);
  const goal = new GoalNear(x, targetY, z, 4);
  try {
    await gotoWithTimeout(bot, goal, GOTO_MS);
    setBlackboard(state, 'lastDiamondCaveY', Math.floor(bot.entity.position.y));
    return true;
  } catch (e) {
    try { bot.pathfinder?.setGoal(null); } catch (e2) {}
  }

  const below = bot.blockAt(new Vec3(x, y - 1, z));
  const under2 = bot.blockAt(new Vec3(x, y - 2, z));
  if (!below || below.name === 'air' || below.name === 'cave_air') return false;
  if (under2 && isFluid(under2.name)) return false;
  if (!await equipBestPick(bot)) return false;
  try {
    await bot.dig(below);
    await new Promise((r) => setTimeout(r, 350));
    setBlackboard(state, 'lastDiamondCaveY', Math.floor(bot.entity.position.y));
    return true;
  } catch (e) {
    return false;
  }
}

async function run(bot, state, params = {}) {
  if (!bot.pathfinder) {
    return { success: false, reason: 'Pathfinder not loaded.' };
  }

  const targetCount = Math.max(1, params.count || 3);
  const maxDist = Math.min(128, Math.max(MAX_SEARCH_DIST, state?.blackboard?.miningMaxDistance ?? MAX_SEARCH_DIST));

  const maxAttempts = 70;
  let attempts = 0;
  let noOreStreak = 0;

  while (countItems(bot, ITEM_NAMES) < targetCount && attempts < maxAttempts) {
    attempts++;

    const block = bot.findBlock({
      matching: (b) => b && SEARCH_NAMES.some((n) => b.name === n || b.name.includes(n)),
      maxDistance: maxDist,
      count: 1,
    });

    if (!block) {
      noOreStreak++;
      if (noOreStreak >= 2 && Math.floor(bot.entity.position.y) > NEED_DESCENT_ABOVE_Y) {
        const ok = await tryDescend(bot, state);
        if (ok) noOreStreak = 0;
      }
      if (noOreStreak > 18) {
        const have = countItems(bot, ITEM_NAMES);
        return {
          success: have >= targetCount,
          reason: have >= targetCount
            ? `Have ${have} diamonds.`
            : `No diamond ore in loaded chunks (~${maxDist}b); descend into a cave or explore (have ${have}).`,
        };
      }
      continue;
    }

    noOreStreak = 0;

    try {
      const goal = new GoalGetToBlock(block.position.x, block.position.y, block.position.z);
      await gotoWithTimeout(bot, goal, GOTO_MS);
    } catch (e) {
      try { bot.pathfinder?.setGoal(null); } catch (e2) {}
      continue;
    }

    const bestTool = bot.pathfinder.bestHarvestTool ? bot.pathfinder.bestHarvestTool(block) : null;
    if (bestTool) {
      const tool = bot.inventory.items().find((i) => i.name === bestTool.name);
      if (tool) await bot.equip(tool, 'hand');
    } else {
      await equipBestPick(bot);
    }

    try {
      await bot.dig(block);
    } catch (e) {
      /* ore gone or protected */
    }
  }

  const has = countItems(bot, ITEM_NAMES);
  return {
    success: has >= targetCount,
    reason: `Cave diamond run: ${has}/${targetCount} (Y≈${Math.floor(bot.entity.position.y)}).`,
  };
}

module.exports = { run, tryDescend, SEARCH_NAMES };
