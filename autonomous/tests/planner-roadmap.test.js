#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, markCompleted } = require('../lib/state');
const { nextRoadmapTask } = require('../lib/planner');

function mockBot() {
  return {
    food: 20,
    health: 20,
    entity: { position: {} },
    time: { isDay: true, timeOfDay: 6000 },
    blackboard: {},
  };
}

function markThrough(state, lastId, list) {
  for (const id of list) {
    markCompleted(state, id);
    if (id === lastId) break;
  }
}

function testAfterWeaponComesFurnace() {
  const state = createState();
  const early = [
    'init_structure', 'connect', 'goto_test', 'collect_wood', 'craft_planks', 'craft_sticks',
    'craft_crafting_table', 'craft_wood_pick', 'collect_cobblestone', 'craft_stone_pick', 'place_crafting_table',
    'collect_more_wood', 'collect_coal', 'craft_chest', 'craft_furnace', 'craft_bed',
    'place_bed', 'place_chest', 'collect_wood_for_house', 'craft_house_planks', 'build_wooden_house',
    'equip_armor', 'equip_weapon',
  ];
  early.forEach((id) => markCompleted(state, id));
  const t = nextRoadmapTask(state, mockBot());
  assert.strictEqual(t.taskId, 'place_furnace');
}

function testAfterWeaponNotObsidianFirst() {
  const state = createState();
  markThrough(state, 'equip_weapon', [
    'init_structure', 'connect', 'goto_test', 'collect_wood', 'craft_planks', 'craft_sticks',
    'craft_crafting_table', 'craft_wood_pick', 'collect_cobblestone', 'craft_stone_pick', 'place_crafting_table',
    'collect_more_wood', 'collect_coal', 'craft_chest', 'craft_furnace', 'craft_bed',
    'place_bed', 'place_chest', 'collect_wood_for_house', 'craft_house_planks', 'build_wooden_house',
    'equip_armor', 'equip_weapon',
  ]);
  const t = nextRoadmapTask(state, mockBot());
  assert.notStrictEqual(t.taskId, 'collect_obsidian', 'must not skip iron/diamond chain');
}

function testDiamondPickBeforeObsidian() {
  const state = createState();
  const upToIron = [
    'init_structure', 'connect', 'goto_test', 'collect_wood', 'craft_planks', 'craft_sticks',
    'craft_crafting_table', 'craft_wood_pick', 'collect_cobblestone', 'craft_stone_pick', 'place_crafting_table',
    'collect_more_wood', 'collect_coal', 'craft_chest', 'craft_furnace', 'craft_bed',
    'place_bed', 'place_chest', 'collect_wood_for_house', 'craft_house_planks', 'build_wooden_house',
    'equip_armor', 'equip_weapon',
    'place_furnace', 'collect_iron_ore', 'smelt_iron_ingots', 'craft_iron_pickaxe', 'craft_stone_shovel',
    'collect_gravel_for_flint', 'craft_flint_and_steel', 'collect_diamond_ore',
  ];
  upToIron.forEach((id) => markCompleted(state, id));
  const t = nextRoadmapTask(state, mockBot());
  assert.strictEqual(t.taskId, 'craft_diamond_pickaxe');
}

function run() {
  testAfterWeaponComesFurnace();
  testAfterWeaponNotObsidianFirst();
  testDiamondPickBeforeObsidian();
  console.log('planner-roadmap.test.js: all passed');
}

run();
