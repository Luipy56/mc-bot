'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { unmarkCompleted } = require('../lib/state');
const { PLANK_NAMES, countAllPlanks, countItems } = require('../lib/inventoryQuery');

const TABLE_FIND_DIST = parseInt(process.env.CRAFTING_TABLE_FIND_DIST || '48', 10);

function materialsHint(requestedName, bot) {
  if (requestedName === 'furnace') {
    const n = countItems(bot, 'cobblestone');
    if (n < 8) return `Need 8 cobblestone for furnace (have ${n}); mine more stone.`;
  }
  if (requestedName === 'wooden_pickaxe') {
    const p = countAllPlanks(bot);
    const s = countItems(bot, 'stick');
    if (p < 3 || s < 2) {
      return `Wooden pickaxe needs 3 planks and 2 sticks (planks ${p}, sticks ${s}).`;
    }
  }
  if (requestedName === 'chest') {
    const p = countAllPlanks(bot);
    if (p < 8) return `Chest needs 8 planks (have ~${p} plank items).`;
  }
  if (requestedName === 'stone_sword') {
    const c = countItems(bot, 'cobblestone');
    const s = countItems(bot, 'stick');
    if (c < 2 || s < 1) return `Stone sword needs 2 cobblestone + 1 stick (cobble ${c}, sticks ${s}).`;
  }
  if (requestedName === 'stone_axe') {
    const c = countItems(bot, 'cobblestone');
    const s = countItems(bot, 'stick');
    if (c < 3 || s < 2) return `Stone axe needs 3 cobblestone + 2 sticks (cobble ${c}, sticks ${s}).`;
  }
  if (requestedName === 'wooden_axe') {
    const p = countAllPlanks(bot);
    const s = countItems(bot, 'stick');
    if (p < 3 || s < 2) return `Wooden axe needs 3 planks + 2 sticks (planks ${p}, sticks ${s}).`;
  }
  if (requestedName === 'iron_sword') {
    const ing = countItems(bot, 'iron_ingot');
    const s = countItems(bot, 'stick');
    if (ing < 2 || s < 1) return `Iron sword needs 2 iron ingots + 1 stick (ingots ${ing}, sticks ${s}).`;
  }
  if (requestedName === 'bucket') {
    const ing = countItems(bot, 'iron_ingot');
    if (ing < 3) return `Bucket needs 3 iron ingots (have ${ing}).`;
  }
  if (requestedName === 'shears') {
    const ing = countItems(bot, 'iron_ingot');
    if (ing < 2) return `Shears need 2 iron ingots (have ${ing}).`;
  }
  if (requestedName === 'stone_hoe') {
    const c = countItems(bot, 'cobblestone');
    const s = countItems(bot, 'stick');
    if (c < 2 || s < 2) return `Stone hoe needs 2 cobblestone + 2 sticks (cobble ${c}, sticks ${s}).`;
  }
  if (requestedName === 'bread') {
    const w = countItems(bot, 'wheat');
    if (w < 3) return `Bread needs 3 wheat (have ${w}).`;
  }
  if (requestedName === 'fishing_rod') {
    const s = countItems(bot, 'stick');
    const str = countItems(bot, 'string');
    if (s < 3 || str < 2) return `Fishing rod needs 3 sticks + 2 string (sticks ${s}, string ${str}).`;
  }
  if (requestedName === 'paper') {
    const cane = countItems(bot, 'sugar_cane');
    if (cane < 3) return `Paper needs 3 sugar cane (have ${cane}).`;
  }
  if (requestedName === 'lantern') {
    const torch = countItems(bot, 'torch');
    const nug = countItems(bot, 'iron_nugget');
    if (torch < 1 || nug < 8) return `Lantern needs 1 torch + 8 iron nuggets (torch ${torch}, nuggets ${nug}).`;
  }
  if (requestedName === 'iron_shovel') {
    const ing = countItems(bot, 'iron_ingot');
    const s = countItems(bot, 'stick');
    if (ing < 1 || s < 2) return `Iron shovel needs 1 iron ingot + 2 sticks (ingots ${ing}, sticks ${s}).`;
  }
  if (requestedName === 'arrow') {
    const flint = countItems(bot, 'flint');
    const s = countItems(bot, 'stick');
    const feather = countItems(bot, 'feather');
    if (flint < 1 || s < 1 || feather < 1) return `Arrows need flint, stick, feather (flint ${flint}, sticks ${s}, feathers ${feather}).`;
  }
  if (requestedName === 'writable_book') {
    const book = countItems(bot, 'book');
    const ink = countItems(bot, 'ink_sac');
    const feather = countItems(bot, 'feather');
    if (book < 1 || ink < 1 || feather < 1) return `Book and quill needs book + ink sac + feather.`;
  }
  if (requestedName === 'torch') {
    const coal = countItems(bot, ['coal', 'charcoal']);
    const s = countItems(bot, 'stick');
    if (coal < 1 || s < 1) return `Torch needs coal/charcoal + stick (coal ${coal}, sticks ${s}).`;
  }
  const ironArmor = {
    iron_boots: 4,
    iron_helmet: 5,
    iron_leggings: 7,
    iron_chestplate: 8,
  };
  if (ironArmor[requestedName]) {
    const ing = countItems(bot, 'iron_ingot');
    const need = ironArmor[requestedName];
    if (ing < need) return `${requestedName} needs ${need} iron ingots (have ${ing}).`;
  }
  return '';
}

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

  if (requestedName.endsWith('_planks') && countAllPlanks(bot) >= count) {
    return { success: true, reason: `Already have at least ${count} planks.` };
  }
  if (requestedName === 'torch' && countItems(bot, 'torch') >= count) {
    return { success: true, reason: `Already have ${countItems(bot, 'torch')} torches.` };
  }
  if (requestedName === 'stone_sword' && countItems(bot, 'stone_sword') >= 1) {
    return { success: true, reason: 'Already have a stone sword.' };
  }
  if (requestedName === 'stone_axe' && countItems(bot, 'stone_axe') >= 1) {
    return { success: true, reason: 'Already have a stone axe.' };
  }
  if (requestedName === 'wooden_axe' && (countItems(bot, 'stone_axe') >= 1 || countItems(bot, 'iron_axe') >= 1)) {
    return { success: true, reason: 'Skip wooden axe; have better axe.' };
  }
  if (requestedName === 'wooden_axe' && countItems(bot, 'wooden_axe') >= 1) {
    return { success: true, reason: 'Already have a wooden axe.' };
  }
  if (requestedName === 'iron_sword' && countItems(bot, 'iron_sword') >= 1) {
    return { success: true, reason: 'Already have an iron sword.' };
  }
  if (requestedName === 'bucket' && (countItems(bot, 'bucket') >= 1 || countItems(bot, 'water_bucket') >= 1)) {
    return { success: true, reason: 'Already have a bucket.' };
  }
  if (requestedName === 'shears' && countItems(bot, 'shears') >= 1) {
    return { success: true, reason: 'Already have shears.' };
  }
  if (requestedName === 'stone_hoe' && countItems(bot, 'stone_hoe') >= 1) {
    return { success: true, reason: 'Already have a stone hoe.' };
  }
  if (requestedName === 'bread' && countItems(bot, 'bread') >= 1) {
    return { success: true, reason: 'Already have bread.' };
  }
  if (requestedName === 'fishing_rod' && countItems(bot, 'fishing_rod') >= 1) {
    return { success: true, reason: 'Already have a fishing rod.' };
  }
  if (requestedName === 'paper' && countItems(bot, 'paper') >= 3) {
    return { success: true, reason: 'Already have enough paper.' };
  }
  if (requestedName === 'lantern' && countItems(bot, 'lantern') >= 1) {
    return { success: true, reason: 'Already have a lantern.' };
  }
  if (requestedName === 'iron_shovel' && countItems(bot, 'iron_shovel') >= 1) {
    return { success: true, reason: 'Already have an iron shovel.' };
  }
  if (requestedName === 'arrow' && countItems(bot, 'arrow') >= 16) {
    return { success: true, reason: 'Already have enough arrows.' };
  }
  if (requestedName === 'writable_book' && countItems(bot, 'writable_book') >= 1) {
    return { success: true, reason: 'Already have a book and quill.' };
  }

  const item = bot.registry?.itemsByName?.[requestedName];
  if (!item) {
    return { success: false, reason: `Unknown item: ${requestedName}.` };
  }

  let table = null;
  let resolved = resolveItemForRecipe(bot, requestedName, null);
  let recipes = resolved.item ? (bot.recipesFor(resolved.item.id, null, 1, null) || []) : [];
  if (!recipes.length) {
    const tableBlock = bot.findBlock({ matching: (b) => b.name === 'crafting_table', maxDistance: TABLE_FIND_DIST });
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
    if (requestedName === 'bucket' && state && countItems(bot, 'iron_ingot') < 3) {
      unmarkCompleted(state, 'collect_iron_ore');
      unmarkCompleted(state, 'smelt_iron_ingots');
    }
    if (requestedName === 'shears' && state && countItems(bot, 'iron_ingot') < 2) {
      unmarkCompleted(state, 'collect_iron_ore');
      unmarkCompleted(state, 'smelt_iron_ingots');
    }
    if (requestedName === 'stone_hoe' && state && (countItems(bot, 'cobblestone') < 2 || countItems(bot, 'stick') < 2)) {
      unmarkCompleted(state, 'collect_cobblestone');
      unmarkCompleted(state, 'craft_sticks');
    }
    const hint = materialsHint(requestedName, bot);
    const tail = hint || 'No matching recipe (missing table or materials).';
    return { success: false, reason: `${tail} (${requestedName})` };
  }

  const recipe = recipes[0];
  if (recipe.requiresTable && !table) {
    const tableBlock = bot.findBlock({ matching: (b) => b.name === 'crafting_table', maxDistance: TABLE_FIND_DIST });
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
    if (requestedName === 'bucket' && state && countItems(bot, 'iron_ingot') < 3) {
      unmarkCompleted(state, 'collect_iron_ore');
      unmarkCompleted(state, 'smelt_iron_ingots');
    }
    if (requestedName === 'shears' && state && countItems(bot, 'iron_ingot') < 2) {
      unmarkCompleted(state, 'collect_iron_ore');
      unmarkCompleted(state, 'smelt_iron_ingots');
    }
    if (requestedName === 'stone_hoe' && state && (countItems(bot, 'cobblestone') < 2 || countItems(bot, 'stick') < 2)) {
      unmarkCompleted(state, 'collect_cobblestone');
      unmarkCompleted(state, 'craft_sticks');
    }
    return { success: false, reason: err.message || 'Craft failed.' };
  }
}

module.exports = { run };
