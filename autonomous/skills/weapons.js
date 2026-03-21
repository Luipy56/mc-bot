'use strict';

const WEAPONS = [
  'netherite_sword', 'diamond_sword', 'iron_sword', 'golden_sword', 'stone_sword', 'wooden_sword',
  'netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe',
];

/**
 * Equip best melee weapon in main hand.
 */
async function run(bot, state, params = {}) {
  const items = bot.inventory.items();
  for (const name of WEAPONS) {
    const item = items.find((i) => i && i.name === name);
    if (item) {
      try {
        await bot.equip(item, 'hand');
        return { success: true, reason: `Equipped ${name}.` };
      } catch (e) {
        // try next
      }
    }
  }
  return { success: true, reason: 'No weapon in inventory.' };
}

module.exports = { run };
