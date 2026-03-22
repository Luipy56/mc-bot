'use strict';

/**
 * Merge catalog-driven skills into the executor map (live-addon + stubs).
 * Skips ids already present on the base `skills` object and all `core` catalog rows.
 */

const collectGrassSeeds = require('../skills/collectGrassSeeds');
const farmWheat = require('../skills/farmWheat');
const milkCow = require('../skills/milkCow');
const extendedPlayerDispatch = require('../skills/extendedPlayerDispatch');
const { SKILL_CATALOG } = require('./playerSkillCatalog');

function buildExtraPlayerSkills(deps) {
  const {
    craftingSkill,
    miningSkill,
    smeltingSkill,
    existingIds,
  } = deps;

  const liveMap = {
    collect_grass_seeds: collectGrassSeeds,
    craft_stone_hoe: craftingSkill,
    till_plant_wheat: farmWheat,
    harvest_mature_wheat: farmWheat,
    craft_bread: craftingSkill,
    milk_cow: milkCow,
    collect_sand: miningSkill,
    smelt_glass: smeltingSkill,
    collect_sugar_cane: miningSkill,
    craft_paper: craftingSkill,
    craft_fishing_rod: craftingSkill,
  };

  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
  const out = {};

  for (const entry of SKILL_CATALOG) {
    if (entry.status === 'core') continue;
    if (existing.has(entry.id)) continue;

    if (entry.status === 'extended') {
      out[entry.id] = extendedPlayerDispatch;
      continue;
    }
    if (entry.status === 'live-addon') {
      const mod = liveMap[entry.id];
      if (mod) out[entry.id] = mod;
    }
  }

  return out;
}

module.exports = { buildExtraPlayerSkills };
