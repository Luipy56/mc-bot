'use strict';

/**
 * Logical grouping of linear roadmap task ids (for logging, env profiles, future DAG).
 */
const ROADMAP_PHASES = Object.freeze([
  {
    id: 'bootstrap',
    taskIds: ['init_structure', 'connect', 'goto_test'],
  },
  {
    id: 'early_survival',
    taskIds: [
      'collect_wood', 'craft_planks', 'craft_sticks', 'craft_crafting_table', 'place_crafting_table',
      'craft_wood_pick', 'collect_cobblestone', 'craft_stone_pick', 'lighten_inventory',
      'craft_stone_sword', 'craft_stone_axe', 'craft_wood_axe', 'collect_more_wood',
      'collect_coal', 'craft_torch', 'craft_chest', 'craft_furnace', 'craft_bed', 'place_bed', 'place_chest',
      'collect_wood_for_house', 'craft_house_planks', 'build_wooden_house',
      'build_potato_farm', 'collect_potatoes', 'smelt_baked_potatoes',
    ],
  },
  {
    id: 'iron_and_combat',
    taskIds: [
      'equip_armor', 'equip_weapon', 'kill_enemy', 'place_furnace', 'lighten_inventory', 'collect_iron_ore',
      'smelt_iron_ingots', 'craft_iron_pickaxe', 'craft_shears', 'shear_sheep', 'craft_iron_sword', 'craft_iron_armor_set', 'equip_iron_kit',
      'craft_iron_bucket', 'fill_water_bucket', 'place_water_source',
      'craft_stone_shovel', 'collect_gravel_for_flint',
      'craft_flint_and_steel',
    ],
  },
  {
    id: 'diamond_nether',
    taskIds: [
      'collect_diamond_ore', 'craft_diamond_pickaxe',
      'shortcut_villager', 'shortcut_enchant', 'shortcut_brew',
      'collect_obsidian', 'build_nether_portal', 'enter_nether', 'collect_blaze_rods',
      'collect_ender_pearls', 'craft_blaze_powder',
    ],
  },
  {
    id: 'endgame',
    taskIds: [
      'craft_eyes_of_ender', 'find_stronghold', 'prep_end_combat', 'fill_end_portal', 'enter_end',
      'destroy_end_crystals', 'kill_ender_dragon',
    ],
  },
  {
    id: 'postgame',
    taskIds: ['postgame_end_city', 'postgame_wither_prep'],
  },
]);

function phaseForTask(taskId) {
  for (const ph of ROADMAP_PHASES) {
    if (ph.taskIds.includes(taskId)) return ph.id;
  }
  return 'other';
}

module.exports = { ROADMAP_PHASES, phaseForTask };
