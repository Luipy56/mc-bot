'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;

/**
 * Craft an item. params: { itemName: string, count: number }.
 * Uses crafting table if recipe.requiresTable; otherwise 2x2 (null).
 */
async function run(bot, state, params = {}) {
  const itemName = params.itemName || 'crafting_table';
  const count = Math.max(1, params.count || 1);

  const item = bot.registry?.itemsByName?.[itemName];
  if (!item) {
    return { success: false, reason: `Unknown item: ${itemName}.` };
  }

  let table = null;
  let recipes = bot.recipesFor(item.id, null, 1, null) || [];
  if (!recipes.length) {
    const tableBlock = bot.findBlock({ matching: (b) => b.name === 'crafting_table', maxDistance: 16 });
    if (tableBlock) {
      try {
        const goal = new GoalGetToBlock(tableBlock.position.x, tableBlock.position.y, tableBlock.position.z);
        await bot.pathfinder.goto(goal);
        table = tableBlock;
        recipes = bot.recipesFor(item.id, null, 1, table) || [];
      } catch (e) {
        return { success: false, reason: 'Could not reach crafting table.' };
      }
    }
  }
  if (!recipes.length) {
    return { success: false, reason: `No recipe for ${itemName}.` };
  }

  const recipe = recipes[0];
  if (recipe.requiresTable && !table) {
    const tableBlock = bot.findBlock({ matching: (b) => b.name === 'crafting_table', maxDistance: 16 });
    if (!tableBlock) return { success: false, reason: 'Crafting table required.' };
    try {
      const goal = new GoalGetToBlock(tableBlock.position.x, tableBlock.position.y, tableBlock.position.z);
      await bot.pathfinder.goto(goal);
      table = tableBlock;
    } catch (e) {
      return { success: false, reason: 'Could not reach crafting table.' };
    }
  }

  try {
    await bot.craft(recipe, count, table);
    return { success: true, reason: `Crafted ${count}x ${itemName}.` };
  } catch (err) {
    return { success: false, reason: err.message || 'Craft failed.' };
  }
}

module.exports = { run };
