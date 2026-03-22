#!/usr/bin/env node
'use strict';

/**
 * Hard-test the task loop without a live server: mock bot, run planner + executor.
 */
console.log('[test-task-loop] Mock bot (no Minecraft): planner → executor; watch task ids below.');
const { createState, markCompleted, isCompleted } = require('./lib/state');
const { nextTask } = require('./lib/brain');
const { createExecutor } = require('./lib/executor');
const movementSkill = require('./skills/movement');

const skills = { goto_test: movementSkill };
const state = createState();
if (!isCompleted(state, 'init_structure')) markCompleted(state, 'init_structure');
['collect_wood', 'craft_planks', 'craft_sticks', 'craft_crafting_table', 'place_crafting_table', 'craft_wood_pick',
  'collect_cobblestone', 'craft_stone_pick', 'lighten_inventory', 'craft_stone_sword', 'craft_stone_axe', 'craft_wood_axe',
  'collect_more_wood', 'collect_coal', 'craft_torch', 'craft_chest', 'craft_furnace', 'craft_bed',
  'place_bed', 'place_chest', 'collect_wood_for_house', 'craft_house_planks', 'build_wooden_house',
  'equip_armor', 'equip_weapon',
  'place_furnace', 'lighten_inventory', 'collect_iron_ore', 'smelt_iron_ingots', 'craft_iron_pickaxe', 'craft_shears',
  'shear_sheep', 'craft_iron_sword',
  'craft_iron_armor_set', 'equip_iron_kit', 'craft_iron_bucket', 'fill_water_bucket', 'place_water_source',
  'craft_stone_shovel',
  'collect_gravel_for_flint', 'craft_flint_and_steel', 'collect_diamond_ore', 'craft_diamond_pickaxe',
  'collect_obsidian', 'build_nether_portal', 'enter_nether', 'collect_blaze_rods', 'collect_ender_pearls',
  'craft_blaze_powder', 'craft_eyes_of_ender', 'find_stronghold', 'prep_end_combat', 'fill_end_portal',
  'enter_end', 'destroy_end_crystals', 'kill_ender_dragon'].forEach((id) => markCompleted(state, id));
const runTask = createExecutor(skills);

const mockBot = {
  entity: { position: { x: 0, y: 64, z: 0 } },
  health: 20,
  food: 20,
  time: { timeOfDay: 6000, isDay: true },
  inventory: { items: () => [] },
  registry: { itemsByName: {} },
  pathfinder: {
    goto: () => Promise.resolve(),
    setGoal: () => {},
  },
};

async function run() {
  const tasks = [];
  for (let i = 0; i < 8; i++) {
    const task = nextTask(state, mockBot);
    tasks.push({ step: i + 1, taskId: task.taskId, reason: task.reason });
    const result = await runTask(mockBot, state, task);
    tasks[tasks.length - 1].success = result.success;
    tasks[tasks.length - 1].resultReason = result.reason;
    if (task.taskId === 'idle') break;
  }

  console.log('Task loop test:');
  tasks.forEach((t) => console.log(`  ${t.step}. ${t.taskId}: ${t.success ? 'ok' : 'fail'} — ${t.resultReason || t.reason}`));

  const actual = tasks.map((t) => t.taskId);
  const gotConnect = actual.includes('connect');
  const gotGoto = actual.includes('goto_test');
  const gotIdle = actual.includes('idle');
  const gotCollectOrCraft = actual.some((id) => id.startsWith('collect_') || id.startsWith('craft_'));

  if (gotConnect && gotGoto && (gotIdle || gotCollectOrCraft)) {
    console.log('\nPASS: Task sequence connect → goto_test → (collect/craft or idle).');
    process.exit(0);
  } else {
    console.log('\nFAIL: Expected connect, goto_test, then progress. Got:', actual);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
