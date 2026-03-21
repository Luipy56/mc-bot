'use strict';

/**
 * From bot → GameState snapshot (position, health, food, time, inventory summary).
 */
function capture(bot) {
  if (!bot || !bot.entity) return null;
  const pos = bot.entity.position;
  const invObj = bot.inventory;
  const rawInv = typeof invObj?.items === 'function' ? invObj.items() : (invObj?.items ?? []);
  const inv = Array.isArray(rawInv) ? rawInv : [];
  const slots = inv.map((item) => ({ name: item?.name, count: item?.count ?? 0 }));
  return {
    position: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
    health: bot.health ?? 0,
    food: bot.food ?? 0,
    timeOfDay: bot.time?.timeOfDay ?? 0,
    isDay: bot.time?.isDay ?? true,
    inventorySlots: slots,
  };
}

module.exports = { capture };
