'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');

/**
 * Smelt ore into ingots using nearest placed furnace.
 * params: { outputName: 'iron_ingot', minCount: 8, oreNames?: string[] }
 */
async function run(bot, state, params = {}) {
  const outputName = params.outputName || 'iron_ingot';
  const minCount = params.minCount ?? 8;
  const oreNames = params.oreNames || ['raw_iron', 'iron_ore'];

  if (countItems(bot, outputName) >= minCount) {
    return { success: true, reason: `Already have ${countItems(bot, outputName)} ${outputName}.` };
  }

  const furnaceBlock = bot.findBlock({ matching: (b) => b.name === 'furnace' || b.name === 'lit_furnace', maxDistance: 24 });
  if (!furnaceBlock) {
    return { success: false, reason: 'Place a furnace nearby first.' };
  }

  try {
    const goal = new GoalGetToBlock(furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z);
    await bot.pathfinder.goto(goal);
  } catch (e) {
    return { success: false, reason: 'Could not reach furnace.' };
  }

  const coalId = bot.registry.itemsByName.coal?.id;
  if (!coalId) return { success: false, reason: 'No coal item in registry.' };

  let oreItem = null;
  for (const name of oreNames) {
    const it = bot.registry.itemsByName[name];
    if (it && bot.inventory.items().some((i) => i.name === name)) {
      oreItem = it;
      break;
    }
  }
  if (!oreItem) {
    return { success: false, reason: 'No smeltable iron (raw_iron/iron_ore) in inventory.' };
  }

  const maxCycles = 40;
  for (let c = 0; c < maxCycles && countItems(bot, outputName) < minCount; c++) {
    let furnace;
    try {
      furnace = await bot.openFurnace(furnaceBlock);
    } catch (e) {
      return { success: false, reason: e.message || 'openFurnace failed.' };
    }
    try {
      const out = furnace.outputItem();
      if (out && out.name === outputName) {
        await furnace.takeOutput();
        continue;
      }
      const inv = bot.inventory.items();
      const ore = inv.find((i) => oreNames.includes(i.name));
      const coal = inv.find((i) => i.name === 'coal' || i.name === 'charcoal');
      if (!ore || !coal) {
        try { await bot.closeWindow(furnace); } catch (e2) {}
        return { success: countItems(bot, outputName) >= minCount, reason: `Smelted; have ${countItems(bot, outputName)} ${outputName}.` };
      }
      await furnace.putInput(ore.type, ore.metadata ?? null, 1);
      await furnace.putFuel(coal.type, coal.metadata ?? null, Math.min(8, coal.count));
      await new Promise((r) => setTimeout(r, 9000));
    } finally {
      try { await bot.closeWindow(furnace); } catch (e) {}
    }
  }

  const have = countItems(bot, outputName);
  return { success: have >= minCount, reason: `Smelting done: ${have}/${minCount} ${outputName}.` };
}

module.exports = { run };
