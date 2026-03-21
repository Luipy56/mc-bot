'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

const PLANKS_NEEDED = parseInt(process.env.HOUSE_PLANKS_NEEDED || '112', 10);
const MAX_CRAFT_LOOPS = 40;

/**
 * Craft oak_planks from logs until we have at least PLANKS_NEEDED (for wooden house).
 */
async function run(bot, state, params = {}) {
  const need = Math.max(1, params.minPlanks ?? PLANKS_NEEDED);
  const item = bot.registry?.itemsByName?.oak_planks;
  if (!item) return { success: false, reason: 'Registry missing oak_planks.' };

  let table = null;
  const getTable = async () => {
    const tableBlock = bot.findBlock({ matching: (b) => b.name === 'crafting_table', maxDistance: 24 });
    if (!tableBlock) return null;
    try {
      const goal = new GoalGetToBlock(tableBlock.position.x, tableBlock.position.y, tableBlock.position.z);
      await bot.pathfinder.goto(goal);
      return tableBlock;
    } catch (e) {
      return null;
    }
  };

  table = await getTable();
  if (!table) return { success: false, reason: 'No crafting table in range.' };

  let recipes = bot.recipesFor(item.id, null, 1, table) || [];
  if (!recipes.length) return { success: false, reason: 'No oak_planks recipe at table.' };
  const recipe = recipes[0];

  let loops = 0;
  while (countItems(bot, 'oak_planks') < need && loops < MAX_CRAFT_LOOPS) {
    if (countItems(bot, 'oak_log') < 1) {
      return {
        success: false,
        reason: `Need more logs; have ${countItems(bot, 'oak_planks')} planks / ${need}.`,
      };
    }
    try {
      await bot.craft(recipe, 1, table);
    } catch (e) {
      return { success: false, reason: e.message || 'Craft planks failed.' };
    }
    loops++;
  }

  const have = countItems(bot, 'oak_planks');
  return {
    success: have >= need,
    reason: have >= need ? `Have ${have} oak planks.` : `Only ${have}/${need} planks after crafting.`,
  };
}

module.exports = { run, PLANKS_NEEDED };
