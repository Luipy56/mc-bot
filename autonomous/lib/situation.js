'use strict';

const { hasItem, countAllLogs, countItems } = require('./inventoryQuery');
const { markCompleted, isCompleted, setBlackboard } = require('./state');

const HOSTILE_NAMES = new Set([
  'zombie', 'zombie_villager', 'husk', 'drowned', 'skeleton', 'stray', 'creeper', 'spider',
  'cave_spider', 'enderman', 'witch', 'phantom', 'slime', 'silverfish', 'pillager', 'vindicator',
  'evoker', 'vex', 'hoglin', 'piglin_brute', 'blaze', 'ghast', 'wither_skeleton',
]);

/**
 * Count hostile mobs within radius of bot (loaded entities only).
 */
function countNearbyHostiles(bot, radius = 20) {
  if (!bot || !bot.entity || !bot.entities) return 0;
  const pos = bot.entity.position;
  let n = 0;
  for (const id of Object.keys(bot.entities)) {
    const e = bot.entities[id];
    if (!e || !e.position || !e.name) continue;
    if (!HOSTILE_NAMES.has(e.name)) continue;
    if (e.position.distanceTo(pos) > radius) continue;
    n++;
  }
  return n;
}

/**
 * Update blackboard with world snapshot for planner.
 */
function updateSituation(bot, state) {
  if (!bot || !state) return;
  const hostiles = countNearbyHostiles(bot, 20);
  setBlackboard(state, 'nearHostiles', hostiles);
  setBlackboard(state, 'isDay', bot.time?.isDay !== false);
  setBlackboard(state, 'timeOfDay', bot.time?.timeOfDay ?? 0);
  if (bot.entity?.position) {
    const p = bot.entity.position;
    setBlackboard(state, 'lastPos', { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
  }
}

/**
 * If inventory already satisfies goals, mark corresponding tasks completed (skip redundant work).
 */
function syncProgressFromInventory(state, bot) {
  if (!bot || !state) return;

  const done = (id) => {
    if (!isCompleted(state, id)) markCompleted(state, id);
  };

  if (countAllLogs(bot) >= 8) done('collect_wood');
  if (hasItem(bot, 'oak_planks', 4) || hasItem(bot, 'spruce_planks', 4) || hasItem(bot, 'birch_planks', 4)) {
    done('craft_planks');
  }
  if (hasItem(bot, 'stick', 4)) done('craft_sticks');
  if (hasItem(bot, 'crafting_table', 1)) done('craft_crafting_table');
  if (hasItem(bot, 'cobblestone', 4)) done('collect_cobblestone');
  if (hasItem(bot, 'stone_pickaxe', 1) || hasItem(bot, 'iron_pickaxe', 1) || hasItem(bot, 'diamond_pickaxe', 1)) {
    done('craft_stone_pick');
  }
  if (countAllLogs(bot) >= 16) done('collect_more_wood');
  if (hasItem(bot, 'coal', 4) || hasItem(bot, 'charcoal', 4)) done('collect_coal');
  if (hasItem(bot, 'chest', 1)) done('craft_chest');
  if (countAllLogs(bot) >= 32) done('collect_wood_for_house');
  if (countItems(bot, 'oak_planks') >= 112) done('craft_house_planks');
  if (hasItem(bot, 'furnace', 1)) done('craft_furnace');
  const bedNames = ['white_bed', 'red_bed', 'blue_bed', 'bed', 'orange_bed', 'yellow_bed', 'lime_bed', 'green_bed', 'cyan_bed', 'light_blue_bed', 'magenta_bed', 'purple_bed', 'pink_bed', 'gray_bed', 'light_gray_bed', 'black_bed', 'brown_bed'];
  if (bedNames.some((n) => hasItem(bot, n, 1))) done('craft_bed');
  if (countItems(bot, 'raw_iron') >= 12 || countItems(bot, 'iron_ore') >= 12) done('collect_iron_ore');
  if (hasItem(bot, 'iron_ingot', 8)) done('smelt_iron_ingots');
  if (hasItem(bot, 'iron_pickaxe', 1)) done('craft_iron_pickaxe');
  if (hasItem(bot, 'stone_shovel', 1) || hasItem(bot, 'iron_shovel', 1)) done('craft_stone_shovel');
  if (hasItem(bot, 'flint', 2)) done('collect_gravel_for_flint');
  if (hasItem(bot, 'flint_and_steel', 1)) done('craft_flint_and_steel');
  if (hasItem(bot, 'diamond', 3)) done('collect_diamond_ore');
  if (hasItem(bot, 'diamond_pickaxe', 1)) done('craft_diamond_pickaxe');
  if (hasItem(bot, 'obsidian', 10)) done('collect_obsidian');
  if (hasItem(bot, 'blaze_rod', 6)) done('collect_blaze_rods');
  if (hasItem(bot, 'ender_pearl', 12)) done('collect_ender_pearls');
  if (hasItem(bot, 'blaze_powder', 12)) done('craft_blaze_powder');
  if (hasItem(bot, 'ender_eye', 12)) done('craft_eyes_of_ender');
}

module.exports = { countNearbyHostiles, updateSituation, syncProgressFromInventory, HOSTILE_NAMES };
