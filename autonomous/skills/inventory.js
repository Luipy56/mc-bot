'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;

/**
 * Open chest at block or nearest chest, optionally deposit/withdraw.
 * params: { action: 'open' | 'deposit' | 'withdraw', itemName?: string, count?: number }.
 * For deposit/withdraw we need to be at a chest; optional itemName/count.
 */
async function run(bot, state, params = {}) {
  const action = params.action || 'open';
  const itemName = params.itemName;
  const count = params.count || 1;

  const chestBlock = bot.findBlock({ matching: (b) => b.name === 'chest' || b.name === 'trapped_chest', maxDistance: 16 });
  if (!chestBlock) {
    return { success: false, reason: 'No chest nearby.' };
  }

  try {
    const goal = new GoalGetToBlock(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z);
    await bot.pathfinder.goto(goal);
  } catch (e) {
    return { success: false, reason: 'Could not reach chest.' };
  }

  const chest = await bot.openChest(chestBlock);
  try {
    if (action === 'deposit' && itemName) {
      const item = bot.inventory.items().find((i) => i.name === itemName);
      if (item) await chest.deposit(item.type, Math.min(count, item.count));
    } else if (action === 'withdraw' && itemName) {
      const item = bot.registry?.itemsByName?.[itemName];
      if (item) await chest.withdraw(item.id, count);
    }
    return { success: true, reason: `Chest ${action} ok.` };
  } finally {
    await chest.close();
  }
}

module.exports = { run };
