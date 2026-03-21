'use strict';

/**
 * Count how many of an item the bot has (by name or names).
 * itemName can be 'oak_log' or array ['oak_log', 'birch_log', 'spruce_log'].
 */
function countItems(bot, itemName) {
  if (!bot) return 0;
  const names = Array.isArray(itemName) ? itemName : [itemName];
  const inv = bot.inventory;
  const raw = typeof inv?.items === 'function' ? inv.items() : (inv?.items ?? []);
  const items = Array.isArray(raw) ? raw : [];
  return items
    .filter((item) => item && names.includes(item.name))
    .reduce((sum, item) => sum + (item.count || 0), 0);
}

function hasItem(bot, itemName, minCount = 1) {
  if (!bot) return false;
  return countItems(bot, itemName) >= minCount;
}

const LOG_NAMES = [
  'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
  'mangrove_log', 'cherry_log',
];
const PLANK_NAMES = [
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks',
  'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks',
];

function countAllLogs(bot) {
  return countItems(bot, LOG_NAMES);
}

function countAllPlanks(bot) {
  return countItems(bot, PLANK_NAMES);
}

module.exports = { countItems, hasItem, countAllLogs, countAllPlanks, LOG_NAMES, PLANK_NAMES };
