'use strict';

const { countItems } = require('../lib/inventoryQuery');
const { emptySlotCount, needsInventoryTrim } = require('../lib/inventorySpace');

const MIN_FREE_DEFAULT = Math.max(2, parseInt(process.env.INVENTORY_TRIM_MIN_FREE || '4', 10));

function hasBetterPick(bot, than) {
  const order = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
  const idx = order.indexOf(than);
  if (idx < 0) return false;
  const items = bot.inventory.items();
  return order.slice(0, idx).some((n) => items.some((i) => i && i.name === n));
}

/**
 * Drop obvious junk / excess so gathering tasks do not stall on full inventory.
 */
async function run(bot, state, params = {}) {
  const minFree = params.minFreeSlots ?? MIN_FREE_DEFAULT;
  if (!needsInventoryTrim(bot, minFree)) {
    return { success: true, reason: `Inventory has ${emptySlotCount(bot)} free slots; no trim needed.` };
  }

  const tossed = [];
  const tryTossCount = async (itemName, maxDrop) => {
    const items = bot.inventory.items().filter((i) => i && i.name === itemName);
    let left = maxDrop;
    for (const it of items) {
      if (left <= 0) break;
      const n = Math.min(it.count, left);
      try {
        await bot.toss(it.type, null, n);
        tossed.push(`${n}x ${itemName}`);
        left -= n;
        await new Promise((r) => setTimeout(r, 280));
      } catch (e) {
        return false;
      }
    }
    return true;
  };

  const cobble = countItems(bot, 'cobblestone');
  if (cobble > 48 && hasBetterPick(bot, 'stone_pickaxe')) {
    await tryTossCount('cobblestone', cobble - 48);
  }

  const dirt = countItems(bot, 'dirt');
  if (dirt > 40) await tryTossCount('dirt', dirt - 32);

  const sand = countItems(bot, 'sand');
  if (sand > 40) await tryTossCount('sand', sand - 32);

  const netherrack = countItems(bot, 'netherrack');
  if (netherrack > 32) await tryTossCount('netherrack', netherrack - 16);

  const flesh = countItems(bot, 'rotten_flesh');
  if (flesh > 32) await tryTossCount('rotten_flesh', flesh - 16);

  const string = countItems(bot, 'string');
  if (string > 24) await tryTossCount('string', string - 16);

  const andesite = countItems(bot, 'andesite');
  if (andesite > 24) await tryTossCount('andesite', andesite - 16);

  const diorite = countItems(bot, 'diorite');
  if (diorite > 24) await tryTossCount('diorite', diorite - 16);

  const granite = countItems(bot, 'granite');
  if (granite > 24) await tryTossCount('granite', granite - 16);

  if (countItems(bot, 'flint') >= 4) {
    const gravel = countItems(bot, 'gravel');
    if (gravel > 16) await tryTossCount('gravel', gravel - 8);
  }

  if (hasBetterPick(bot, 'wooden_pickaxe')) {
    const woodPicks = bot.inventory.items().filter((i) => i && i.name === 'wooden_pickaxe');
    for (const it of woodPicks.slice(0, 2)) {
      try {
        await bot.toss(it.type, null, it.count);
        tossed.push(`stack wooden_pickaxe`);
        await new Promise((r) => setTimeout(r, 280));
      } catch (e) { /* ignore */ }
    }
  }

  const now = emptySlotCount(bot);
  return {
    success: now >= minFree || tossed.length > 0,
    reason: tossed.length
      ? `Trimmed: ${tossed.join(', ')}; ~${now} free slots.`
      : `Could not free enough slots (have ${now} free); try a chest.`,
  };
}

module.exports = { run };
