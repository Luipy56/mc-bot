'use strict';

/** Free slots in main inventory (best-effort for Mineflayer 4.x). */
function emptySlotCount(bot) {
  if (!bot?.inventory) return 99;
  try {
    if (typeof bot.inventory.emptySlotCount === 'function') return bot.inventory.emptySlotCount();
  } catch (e) { /* ignore */ }
  const inv = bot.inventory;
  if (!Array.isArray(inv.slots)) return 20;
  const start = inv.inventoryStart ?? 9;
  const end = inv.inventoryEnd ?? 45;
  let n = 0;
  for (let i = start; i < end; i++) {
    if (!inv.slots[i]) n++;
  }
  return n;
}

function needsInventoryTrim(bot, minFree = 4) {
  return emptySlotCount(bot) < minFree;
}

module.exports = { emptySlotCount, needsInventoryTrim };
