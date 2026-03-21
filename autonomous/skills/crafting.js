'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { PLANK_NAMES } = require('../lib/inventoryQuery');

function resolveItemForRecipe(bot, requestedName, table) {
  const direct = bot.registry?.itemsByName?.[requestedName];
  if (!direct) return { item: null, itemName: requestedName };
  const directRecipes = bot.recipesFor(direct.id, null, 1, table) || [];
  if (directRecipes.length > 0) return { item: direct, itemName: requestedName };

  if (requestedName.endsWith('_planks')) {
    for (const alt of PLANK_NAMES) {
      const altItem = bot.registry?.itemsByName?.[alt];
      if (!altItem) continue;
      const altRecipes = bot.recipesFor(altItem.id, null, 1, table) || [];
      if (altRecipes.length > 0) {
        return { item: altItem, itemName: alt };
      }
    }
  }
  return { item: direct, itemName: requestedName };
}

/**
 * Craft an item. params: { itemName: string, count: number }.
 * Uses crafting table if recipe.requiresTable; otherwise 2x2 (null).
 */
async function run(bot, state, params = {}) {
  const requestedName = params.itemName || 'crafting_table';
  const count = Math.max(1, params.count || 1);

  const item = bot.registry?.itemsByName?.[requestedName];
  if (!item) {
    return { success: false, reason: `Unknown item: ${requestedName}.` };
  }

  let table = null;
  let resolved = resolveItemForRecipe(bot, requestedName, null);
  let recipes = resolved.item ? (bot.recipesFor(resolved.item.id, null, 1, null) || []) : [];
  if (!recipes.length) {
    const tableBlock = bot.findBlock({ matching: (b) => b.name === 'crafting_table', maxDistance: 16 });
    if (tableBlock) {
      try {
        const goal = new GoalGetToBlock(tableBlock.position.x, tableBlock.position.y, tableBlock.position.z);
        await bot.pathfinder.goto(goal);
        table = tableBlock;
        resolved = resolveItemForRecipe(bot, requestedName, table);
        recipes = resolved.item ? (bot.recipesFor(resolved.item.id, null, 1, table) || []) : [];
      } catch (e) {
        return { success: false, reason: 'Could not reach crafting table.' };
      }
    }
  }
  if (!recipes.length) {
    return { success: false, reason: `No recipe for ${requestedName}.` };
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
    return { success: true, reason: `Crafted ${count}x ${resolved.itemName}.` };
  } catch (err) {
    return { success: false, reason: err.message || 'Craft failed.' };
  }
}

module.exports = { run };
