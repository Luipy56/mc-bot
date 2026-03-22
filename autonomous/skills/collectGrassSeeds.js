'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

const GOTO_MS = parseInt(process.env.COLLECT_SEEDS_GOTO_MS || '20000', 10);
/** 1.21+ short_grass; older grass / tall variants. */
const GRASS_NAMES = new Set([
  'short_grass', 'grass', 'tall_grass', 'fern', 'large_fern',
]);

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

/**
 * Break grass-like plants for wheat_seeds. params: { count?: number, maxDistance?: number }
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder) return { success: false, reason: 'Pathfinder not loaded.' };
  if (state?.blackboard?.regionProtected) {
    return { success: false, reason: 'Protected area; cannot break grass.' };
  }

  const want = Math.max(1, params.count ?? 4);
  const maxDist = params.maxDistance ?? 36;

  if (countItems(bot, 'wheat_seeds') >= want) {
    return { success: true, reason: `Already have ${countItems(bot, 'wheat_seeds')} wheat seeds.` };
  }

  let attempts = 0;
  const maxAttempts = 45;

  while (countItems(bot, 'wheat_seeds') < want && attempts < maxAttempts) {
    attempts++;
    const block = bot.findBlock({
      point: bot.entity.position,
      maxDistance: maxDist,
      matching: (b) => b && GRASS_NAMES.has(b.name),
    });
    if (!block) {
      return {
        success: countItems(bot, 'wheat_seeds') >= want,
        reason: `No grass/fern nearby; have ${countItems(bot, 'wheat_seeds')} seeds.`,
      };
    }

    try {
      await gotoTimeout(bot, new GoalGetToBlock(block.position.x, block.position.y, block.position.z), GOTO_MS);
    } catch (e) {
      continue;
    }

    try {
      await bot.dig(block);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('protected')) {
        return { success: false, reason: 'Cannot break grass here (protected).' };
      }
    }
  }

  const have = countItems(bot, 'wheat_seeds');
  return {
    success: have >= want,
    reason: have >= want ? `Collected wheat seeds (${have}).` : `Only ${have}/${want} seeds from grass.`,
  };
}

module.exports = { run, GRASS_NAMES };
