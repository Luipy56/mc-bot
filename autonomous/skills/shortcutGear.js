'use strict';

const { GoalNear } = require('mineflayer-pathfinder').goals;

async function runVillager(bot, state, params) {
  const v = bot.nearestEntity(
    (e) => e.name === 'villager' && e.position.distanceTo(bot.entity.position) < 32
  );
  if (!v) {
    return { success: false, reason: 'No villager nearby (build hall / transport villager).' };
  }
  try {
    const p = v.position;
    await bot.pathfinder.goto(new GoalNear(p.x, p.y, p.z, 2));
    await bot.lookAt(p.offset(0, 1.2, 0));
    await bot.openVillager(v);
    await new Promise((r) => setTimeout(r, 800));
    try {
      if (bot.currentWindow) await bot.closeWindow(bot.currentWindow);
    } catch (e) {}
    return { success: true, reason: 'Opened villager trade (extend for specific trades).' };
  } catch (e) {
    return { success: false, reason: e.message || 'Villager interact failed.' };
  }
}

async function runEnchant(bot, state, params) {
  const table = bot.findBlock({ matching: (b) => b.name === 'enchanting_table', maxDistance: 24 });
  if (!table) {
    return { success: false, reason: 'No enchanting table nearby (place table + bookshelves).' };
  }
  try {
    await bot.pathfinder.goto(new GoalNear(table.position.x, table.position.y, table.position.z, 2));
    await bot.lookAt(table.position.offset(0.5, 0.5, 0.5));
    const ench = await bot.openEnchantmentTable(table);
    await new Promise((r) => setTimeout(r, 400));
    try { await bot.closeWindow(ench); } catch (e) {}
    return { success: true, reason: 'Opened enchanting table (extend for chosen enchant).' };
  } catch (e) {
    return { success: false, reason: e.message || 'Enchant open failed.' };
  }
}

async function runBrew(bot, state, params) {
  const stand = bot.findBlock({ matching: (b) => b.name === 'brewing_stand', maxDistance: 24 });
  if (!stand) {
    return { success: false, reason: 'No brewing stand nearby.' };
  }
  try {
    await bot.pathfinder.goto(new GoalNear(stand.position.x, stand.position.y, stand.position.z, 2));
    await bot.lookAt(stand.position.offset(0.5, 0.5, 0.5));
    await bot.activateBlock(stand);
    await new Promise((r) => setTimeout(r, 600));
    try {
      if (bot.currentWindow) await bot.closeWindow(bot.currentWindow);
    } catch (e) {}
    return { success: true, reason: 'Activated brewing stand (extend for potion automation).' };
  } catch (e) {
    return { success: false, reason: e.message || 'Brewing interact failed.' };
  }
}

const runners = {
  shortcut_villager: runVillager,
  shortcut_enchant: runEnchant,
  shortcut_brew: runBrew,
};

async function run(bot, state, params) {
  const key = params._taskId || state._currentTaskId;
  const fn = runners[key];
  if (fn) return fn(bot, state, params);
  return { success: false, reason: 'Unknown shortcut task.' };
}

module.exports = { run, runVillager, runEnchant, runBrew };
