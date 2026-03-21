'use strict';

const EDIBLE_PRIORITY = [
  'golden_apple',
  'cooked_beef',
  'cooked_porkchop',
  'cooked_mutton',
  'cooked_chicken',
  'cooked_rabbit',
  'baked_potato',
  'bread',
  'carrot',
  'apple',
  'beef',
  'porkchop',
  'mutton',
  'chicken',
  'rabbit',
  'potato',
  'cod',
  'salmon',
  'cooked_cod',
  'cooked_salmon',
  'melon_slice',
  'sweet_berries',
];

const RAW_MEAT_NAMES = ['beef', 'porkchop', 'chicken', 'mutton', 'rabbit'];
const MEAT_NAMES = [
  'beef', 'porkchop', 'chicken', 'mutton', 'rabbit',
  'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_rabbit',
];
const PASSIVE_FOOD_MOBS = ['cow', 'pig', 'chicken', 'sheep', 'rabbit', 'mooshroom'];

function inventoryItems(bot) {
  if (!bot) return [];
  const raw = typeof bot.inventory?.items === 'function' ? bot.inventory.items() : [];
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
}

function countItemsByNames(bot, names) {
  const allowed = new Set(Array.isArray(names) ? names : [names]);
  return inventoryItems(bot)
    .filter((i) => allowed.has(i.name))
    .reduce((sum, i) => sum + (i.count || 0), 0);
}

function findBestFoodItem(bot) {
  const items = inventoryItems(bot);
  if (items.length === 0) return null;
  for (const name of EDIBLE_PRIORITY) {
    const found = items.find((i) => i.name === name);
    if (found) return found;
  }
  return null;
}

function hasEdibleFood(bot) {
  return Boolean(findBestFoodItem(bot));
}

module.exports = {
  EDIBLE_PRIORITY,
  RAW_MEAT_NAMES,
  MEAT_NAMES,
  PASSIVE_FOOD_MOBS,
  inventoryItems,
  countItemsByNames,
  findBestFoodItem,
  hasEdibleFood,
};
