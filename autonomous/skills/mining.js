'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

/** Pathfinder can hang indefinitely on unreachable/unbreakable blocks (PrismarineJS/mineflayer-pathfinder#222). */
const GOTO_BLOCK_TIMEOUT_MS = parseInt(process.env.MINING_GOTO_TIMEOUT_MS || '25000', 10);

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

function matchBlockName(block, names) {
  if (!block || !block.name) return false;
  return names.some((n) => block.name === n || block.name.endsWith('_' + n) || block.name === n.replace('_log', ''));
}

/**
 * Collect blocks by name until we have at least `count`.
 * params: { blockName: 'oak_log' | 'cobblestone' | 'log', count: number }.
 */
async function run(bot, state, params = {}) {
  const blockName = params.blockName || 'oak_log';
  const targetCount = Math.max(1, params.count || 4);

  if (!bot.pathfinder) {
    return { success: false, reason: 'Pathfinder not loaded.' };
  }

  const isLog = ['log', 'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'].some((n) => blockName.includes(n));
  const isCoalOre = blockName.includes('coal');
  const isIronOre = blockName.includes('iron');
  const isDiamondOre = blockName.includes('diamond');
  const isGravel = blockName === 'gravel' || blockName.includes('gravel');
  let matchNames = isLog ? WOOD_BLOCK_NAMES : (isCoalOre ? ['coal'] : [blockName]);
  let searchBlockNames = isCoalOre ? ['coal_ore', 'deepslate_coal_ore'] : matchNames;
  if (isIronOre) {
    searchBlockNames = ['iron_ore', 'deepslate_iron_ore'];
    matchNames = ['raw_iron', 'iron_ingot'];
  } else if (isDiamondOre) {
    searchBlockNames = ['diamond_ore', 'deepslate_diamond_ore'];
    matchNames = ['diamond'];
  } else if (isGravel) {
    searchBlockNames = ['gravel'];
    matchNames = params.countAsNames || ['flint', 'gravel'];
  }
  if (Array.isArray(params.countAsNames) && params.countAsNames.length) {
    matchNames = params.countAsNames;
  }

  const maxAttempts = 50;
  let attempts = 0;
  const maxDist = Math.min(96, state?.blackboard?.miningMaxDistance ?? 32);

  while (countItems(bot, matchNames) < targetCount && attempts < maxAttempts) {
    attempts++;
    const block = bot.findBlock({
      matching: (b) => b && searchBlockNames.some((n) => (b.name === n || b.name.includes(n))),
      maxDistance: maxDist,
      count: 1,
    });

    if (!block) {
      return { success: countItems(bot, matchNames) >= targetCount, reason: `No ${blockName} found nearby. Have ${countItems(bot, matchNames)}.` };
    }

    try {
      const goal = new GoalGetToBlock(block.position.x, block.position.y, block.position.z);
      await gotoWithTimeout(bot, goal, GOTO_BLOCK_TIMEOUT_MS);
    } catch (e) {
      try { bot.pathfinder?.setGoal(null); } catch (e2) {}
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
      // Block might have been broken or unreachable
    }
  }

  const has = countItems(bot, matchNames);
  return { success: has >= targetCount, reason: `Collected ${blockName}: have ${has}/${targetCount}.` };
}

module.exports = { run };
