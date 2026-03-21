'use strict';

const { GoalGetToBlock, GoalNear } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');
const { setBlackboard } = require('../lib/state');

/** Pathfinder can hang indefinitely on unreachable/unbreakable blocks (PrismarineJS/mineflayer-pathfinder#222). */
const GOTO_BLOCK_TIMEOUT_MS = parseInt(process.env.MINING_GOTO_TIMEOUT_MS || '25000', 10);
const LOG_VERTICAL_DELTA = parseInt(process.env.LOG_VERTICAL_DELTA || '4', 10);
const LOG_GOAL_RADIUS = parseInt(process.env.LOG_GOAL_RADIUS || '2', 10);

function gotoWithTimeout(bot, goal, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try { bot.pathfinder?.setGoal(null); } catch (e) {}
      reject(new Error('Path to block timed out; skipping block.'));
    }, ms);
    bot.pathfinder.goto(goal).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

const LOG_NAMES = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'];
const WOOD_BLOCK_NAMES = ['oak_log', 'log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'];

function matchesSearchName(name, names) {
  if (!name) return false;
  return names.some((n) => name === n || name.includes(n));
}

function findTargetBlock(bot, searchBlockNames, maxDist, isLog, verticalDelta) {
  const positions = bot.findBlocks({
    matching: (b) => b && b.name && matchesSearchName(b.name, searchBlockNames),
    maxDistance: maxDist,
    count: isLog ? 128 : 64,
  });
  for (const pos of positions) {
    const block = bot.blockAt(pos);
    if (!block || !matchesSearchName(block.name, searchBlockNames)) continue;
    if (isLog && bot.entity) {
      const dy = block.position.y - bot.entity.position.y;
      if (dy > verticalDelta) continue;
    }
    return block;
  }
  return null;
}

/**
 * Collect blocks by name until we have at least `count`.
 * params: { blockName: 'oak_log' | 'cobblestone' | 'log', count: number }.
 */
async function run(bot, state, params = {}) {
  const blockName = params.blockName || 'oak_log';
  const targetCount = Math.max(1, params.count || 4);
  const exactName = typeof params.exactName === 'string' && params.exactName ? params.exactName : null;
  const logVerticalDelta = parseInt(params.verticalDelta ?? LOG_VERTICAL_DELTA, 10);

  if (!bot.pathfinder) {
    return { success: false, reason: 'Pathfinder not loaded.' };
  }
  if (state?.blackboard?.regionProtected) {
    return { success: false, reason: 'Protected area blocks mining; explore farther first.' };
  }

  const isLog = ['log', 'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'].some((n) => blockName.includes(n));
  const isCoalOre = blockName.includes('coal');
  const isIronOre = blockName.includes('iron');
  const isDiamondOre = blockName.includes('diamond');
  const isCobblestone = blockName === 'cobblestone' || blockName.includes('cobblestone');
  const isGravel = blockName === 'gravel' || blockName.includes('gravel');
  let matchNames = isLog ? (exactName ? [exactName] : WOOD_BLOCK_NAMES) : (isCoalOre ? ['coal'] : [blockName]);
  let searchBlockNames = isCoalOre ? ['coal_ore', 'deepslate_coal_ore'] : matchNames;
  if (isIronOre) {
    searchBlockNames = ['iron_ore', 'deepslate_iron_ore'];
    matchNames = ['raw_iron', 'iron_ingot'];
  } else if (isDiamondOre) {
    searchBlockNames = ['diamond_ore', 'deepslate_diamond_ore'];
    matchNames = ['diamond'];
  } else if (isCobblestone) {
    // Cobblestone is usually obtained by mining stone/deepslate with a pickaxe.
    searchBlockNames = ['stone', 'deepslate', 'cobblestone'];
    matchNames = ['cobblestone'];
  } else if (isGravel) {
    searchBlockNames = ['gravel'];
    matchNames = params.countAsNames || ['flint', 'gravel'];
  }
  if (Array.isArray(params.countAsNames) && params.countAsNames.length) {
    matchNames = params.countAsNames;
  }
  if (exactName && isLog) {
    searchBlockNames = [exactName];
  }

  const maxAttempts = 50;
  let attempts = 0;
  const maxDist = Math.min(192, state?.blackboard?.miningMaxDistance ?? 32);

  while (countItems(bot, matchNames) < targetCount && attempts < maxAttempts) {
    if (state?.blackboard?.regionProtected) {
      return { success: false, reason: 'Protected area blocks mining; explore farther first.' };
    }
    attempts++;
    const block = findTargetBlock(bot, searchBlockNames, maxDist, isLog, logVerticalDelta);

    if (!block) {
      return { success: countItems(bot, matchNames) >= targetCount, reason: `No ${blockName} found nearby. Have ${countItems(bot, matchNames)}.` };
    }

    try {
      const goal = isLog
        ? new GoalNear(block.position.x, block.position.y, block.position.z, LOG_GOAL_RADIUS)
        : new GoalGetToBlock(block.position.x, block.position.y, block.position.z);
      await gotoWithTimeout(bot, goal, GOTO_BLOCK_TIMEOUT_MS);
    } catch (e) {
      try { bot.pathfinder?.setGoal(null); } catch (e2) {}
      continue;
    }

    if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(block)) {
      if (state?.blackboard?.regionProtected) {
        return { success: false, reason: 'Protected area blocks mining; explore farther first.' };
      }
      continue;
    }

    const bestTool = bot.pathfinder.bestHarvestTool ? bot.pathfinder.bestHarvestTool(block) : null;
    if (bestTool) {
      const tool = bot.inventory.items().find((i) => i.name === bestTool.name);
      if (tool) await bot.equip(tool, 'hand');
    }

    try {
      await bot.dig(block);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes("can't break") || msg.includes('cannot break') || msg.includes('protected')) {
        setBlackboard(state, 'regionProtected', true);
        return { success: false, reason: 'Protected area blocks mining; explore farther first.' };
      }
      // Block might have been broken or unreachable
    }
  }

  const has = countItems(bot, matchNames);
  return { success: has >= targetCount, reason: `Collected ${blockName}: have ${has}/${targetCount}.` };
}

module.exports = { run };
