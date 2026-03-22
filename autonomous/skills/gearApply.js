'use strict';

const armorSkill = require('./armor');
const weaponsSkill = require('./weapons');

/**
 * Equip best armor then best melee weapon (after crafting upgrades).
 */
async function run(bot, state, params = {}) {
  const a = await armorSkill.run(bot, state, params);
  const w = await weaponsSkill.run(bot, state, params);
  const ok = a.success !== false && w.success !== false;
  return {
    success: ok,
    reason: `Gear: ${a.reason || ''} | ${w.reason || ''}`,
  };
}

module.exports = { run };
