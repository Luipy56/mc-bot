'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

const GOTO_MS = parseInt(process.env.POTATO_COLLECT_GOTO_MS || '20000', 10);
const MAX_TRIES = 40;

function gotoTimeout(bot, goal, ms) {
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

function isPotatoCrop(block) {
  return block && (block.name === 'potatoes' || block.name === 'potato');
}

/**
 * Harvest potato crops until we have at least `count` potatoes (for replanting).
 * Needs existing potato plants nearby (village farm, etc.).
 */
async function run(bot, state, params = {}) {
  const need = Math.max(1, params.count || 8);
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };

  let tries = 0;
  while (countItems(bot, 'potato') < need && tries < MAX_TRIES) {
    tries++;
    const block = bot.findBlock({
      matching: (b) => isPotatoCrop(b),
      maxDistance: Math.min(64, state?.blackboard?.miningMaxDistance ?? 48),
      count: 1,
    });
    if (!block) {
      return {
        success: countItems(bot, 'potato') >= need,
        reason: countItems(bot, 'potato') >= need
          ? `Have ${countItems(bot, 'potato')} potatoes.`
          : `No potato crops nearby; have ${countItems(bot, 'potato')}/${need}. Find a village farm or plant potatoes first.`,
      };
    }
    try {
      await gotoTimeout(bot, new GoalGetToBlock(block.position.x, block.position.y, block.position.z), GOTO_MS);
    } catch (e) {
      continue;
    }
    try {
      await bot.dig(block);
    } catch (e) {
      /* ignore */
    }
  }

  const have = countItems(bot, 'potato');
  return {
    success: have >= need,
    reason: have >= need ? `Collected ${have} potatoes.` : `Only ${have}/${need} potatoes after ${tries} tries.`,
  };
}

module.exports = { run, isPotatoCrop };
