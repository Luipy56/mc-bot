'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems, PLANK_NAMES } = require('../lib/inventoryQuery');
const { setBlackboard } = require('../lib/state');

const PLANKS_NEEDED = parseInt(process.env.HOUSE_PLANKS_NEEDED || '112', 10);
const MAX_CRAFT_LOOPS = 40;

/**
 * Craft planks from available logs until we have at least PLANKS_NEEDED (for wooden house).
 */
async function run(bot, state, params = {}) {
  const need = Math.max(1, params.minPlanks ?? PLANKS_NEEDED);
  const preferredFromEnv = (process.env.HOUSE_PLANK_NAME || '').trim();
  const requested = (params.plankName || preferredFromEnv || '').trim();
  const strict = params.strict === true || /^(1|true|yes)$/i.test(process.env.HOUSE_PLANK_STRICT || '');

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

  // Planks recipe is 2x2 and does not require table, but if table exists nearby we can still use it.
  table = await getTable();

  const preferred = requested || state?.blackboard?.housePlankName;
  const ordered = preferred
    ? [preferred, ...PLANK_NAMES.filter((n) => n !== preferred)]
    : [...PLANK_NAMES];

  let plankName = null;
  let recipe = null;
  for (const name of ordered) {
    const item = bot.registry?.itemsByName?.[name];
    if (!item) continue;
    const tableRecipes = bot.recipesFor(item.id, null, 1, table) || [];
    const handRecipes = bot.recipesFor(item.id, null, 1, null) || [];
    const recipes = tableRecipes.length > 0 ? tableRecipes : handRecipes;
    if (recipes.length > 0) {
      plankName = name;
      recipe = recipes[0];
      break;
    }
  }
  if (strict && preferred && plankName !== preferred) {
    return { success: false, reason: `Strict plank mode enabled; could not craft ${preferred}.` };
  }
  if (!plankName || !recipe) return { success: false, reason: 'No plank recipe available at table.' };
  setBlackboard(state, 'housePlankName', plankName);

  let loops = 0;
  while (countItems(bot, plankName) < need && loops < MAX_CRAFT_LOOPS) {
    const before = countItems(bot, plankName);
    try {
      await bot.craft(recipe, 1, table);
    } catch (e) {
      return { success: false, reason: e.message || 'Craft planks failed.' };
    }
    const after = countItems(bot, plankName);
    if (after <= before) {
      return { success: false, reason: `Could not increase ${plankName}; likely out of logs.` };
    }
    loops++;
  }

  const have = countItems(bot, plankName);
  return {
    success: have >= need,
    reason: have >= need ? `Have ${have} ${plankName}.` : `Only ${have}/${need} ${plankName} after crafting.`,
  };
}

module.exports = { run, PLANKS_NEEDED };
