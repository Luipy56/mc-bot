#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, markCompleted, isCompleted } = require('../lib/state');
const { nextTask } = require('../lib/brain');

const mockBot = (overrides = {}) => ({
  food: 20,
  health: 20,
  entity: { position: {} },
  inventory: { items: () => [] },
  registry: { itemsByName: {} },
  time: { isDay: true, timeOfDay: 6000 },
  entities: {},
  ...overrides,
});

function testNullState() {
  const task = nextTask(null, mockBot());
  assert.strictEqual(task.taskId, 'idle');
  assert.ok(task.reason);
}

function testInitAndConnect() {
  const state = createState();
  let task = nextTask(state, mockBot());
  assert.strictEqual(task.taskId, 'init_structure');
  markCompleted(state, 'init_structure');
  task = nextTask(state, mockBot());
  assert.strictEqual(task.taskId, 'connect');
  markCompleted(state, 'connect');
  task = nextTask(state, mockBot());
  assert.strictEqual(task.taskId, 'goto_test');
}

function testEatWhenLowFood() {
  const state = createState();
  ['init_structure', 'connect', 'goto_test'].forEach((id) => markCompleted(state, id));
  const bot = mockBot({ food: 5 });
  const task = nextTask(state, bot);
  assert.strictEqual(task.taskId, 'eat_if_needed');
}

function testCollectWoodWhenEnoughFood() {
  const state = createState();
  ['init_structure', 'connect', 'goto_test'].forEach((id) => markCompleted(state, id));
  const task = nextTask(state, mockBot({ food: 20 }));
  assert.strictEqual(task.taskId, 'collect_wood');
  assert.strictEqual(task.params.blockName, 'oak_log');
}

function testGotoUsesSpawnFromBlackboard() {
  const state = createState();
  ['init_structure', 'connect'].forEach((id) => markCompleted(state, id));
  state.blackboard = { spawnPos: { x: 100, y: 70, z: -50 } };
  const task = nextTask(state, mockBot());
  assert.strictEqual(task.taskId, 'goto_test');
  assert.strictEqual(task.params.x, 100);
  assert.strictEqual(task.params.y, 70);
  assert.strictEqual(task.params.z, -50);
}

function testInventorySyncSkipsCollectWood() {
  const state = createState();
  ['init_structure', 'connect', 'goto_test'].forEach((id) => markCompleted(state, id));
  const bot = mockBot({
    food: 20,
    inventory: { items: () => [{ name: 'oak_log', count: 12 }] },
  });
  const task = nextTask(state, bot);
  assert.strictEqual(isCompleted(state, 'collect_wood'), true);
  assert.strictEqual(task.taskId, 'craft_planks');
}

function testDangerousNightPrioritizesSleep() {
  const state = createState();
  ['init_structure', 'connect', 'goto_test', 'collect_wood', 'craft_planks', 'craft_sticks',
    'craft_crafting_table', 'collect_cobblestone', 'craft_stone_pick', 'place_crafting_table',
    'collect_more_wood', 'collect_coal', 'craft_chest', 'craft_furnace', 'craft_bed', 'place_bed', 'place_chest'].forEach((id) => markCompleted(state, id));
  state.blackboard.nearHostiles = 3;
  const bot = mockBot({
    food: 20,
    time: { isDay: false, timeOfDay: 13000 },
    entities: {
      1: { name: 'zombie', position: { distanceTo: () => 5 } },
      2: { name: 'zombie', position: { distanceTo: () => 8 } },
      3: { name: 'zombie', position: { distanceTo: () => 10 } },
    },
  });
  const task = nextTask(state, bot);
  assert.strictEqual(task.taskId, 'sleep_in_bed');
}

function testIdleWhenAllDone() {
  const state = createState();
  const allTasks = [
    'init_structure', 'connect', 'goto_test', 'collect_wood', 'craft_planks', 'craft_sticks',
    'craft_crafting_table', 'collect_cobblestone', 'craft_stone_pick', 'place_crafting_table',
    'collect_more_wood', 'collect_coal', 'craft_chest', 'craft_furnace', 'craft_bed',
    'place_bed', 'place_chest', 'collect_wood_for_house', 'craft_house_planks', 'build_wooden_house',
    'equip_armor', 'equip_weapon',
    'place_furnace', 'collect_iron_ore', 'smelt_iron_ingots', 'craft_iron_pickaxe', 'craft_stone_shovel',
    'collect_gravel_for_flint', 'craft_flint_and_steel', 'collect_diamond_ore', 'craft_diamond_pickaxe',
    'collect_obsidian', 'build_nether_portal', 'enter_nether', 'collect_blaze_rods', 'collect_ender_pearls',
    'craft_blaze_powder', 'craft_eyes_of_ender', 'find_stronghold', 'enter_end', 'kill_ender_dragon',
  ];
  allTasks.forEach((id) => markCompleted(state, id));
  const task = nextTask(state, mockBot());
  assert.strictEqual(task.taskId, 'idle');
  assert.ok(task.reason.includes('complete') || task.reason.includes('idle'));
}

function run() {
  testNullState();
  testInitAndConnect();
  testEatWhenLowFood();
  testCollectWoodWhenEnoughFood();
  testGotoUsesSpawnFromBlackboard();
  testInventorySyncSkipsCollectWood();
  testDangerousNightPrioritizesSleep();
  testIdleWhenAllDone();
  console.log('planner.test.js: all passed');
}

run();
