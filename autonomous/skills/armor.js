'use strict';

const ARMOR_SLOTS = ['head', 'torso', 'legs', 'feet'];
const ARMOR_ITEMS = {
  head: ['turtle_helmet', 'leather_helmet', 'chainmail_helmet', 'iron_helmet', 'golden_helmet', 'diamond_helmet', 'netherite_helmet'],
  torso: ['leather_chestplate', 'chainmail_chestplate', 'iron_chestplate', 'golden_chestplate', 'diamond_chestplate', 'netherite_chestplate'],
  legs: ['leather_leggings', 'chainmail_leggings', 'iron_leggings', 'golden_leggings', 'diamond_leggings', 'netherite_leggings'],
  feet: ['leather_boots', 'chainmail_boots', 'iron_boots', 'golden_boots', 'diamond_boots', 'netherite_boots'],
};

/**
 * Equip best available armor from inventory (by order: better items later in list).
 */
async function run(bot, state, params = {}) {
  let equipped = 0;
  for (const slot of ARMOR_SLOTS) {
    const names = ARMOR_ITEMS[slot];
    const items = bot.inventory.items();
    for (let i = names.length - 1; i >= 0; i--) {
      const piece = items.find((it) => it && it.name === names[i]);
      if (piece) {
        try {
          await bot.equip(piece, slot);
          equipped++;
          break;
        } catch (e) {
          // skip
        }
      }
    }
  }
  return { success: true, reason: `Equipped ${equipped} armor piece(s).` };
}

module.exports = { run };
