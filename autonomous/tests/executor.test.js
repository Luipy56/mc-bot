#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, markCompleted, isCompleted } = require('../lib/state');
const { createExecutor } = require('../lib/executor');
const movementSkill = require('../skills/movement');

const mockBot = () => ({
  entity: { position: { x: 0, y: 64, z: 0 } },
  health: 20,
  food: 20,
  time: { timeOfDay: 6000, isDay: true },
  inventory: { items: () => [] },
  pathfinder: { goto: () => Promise.resolve(), setGoal: () => {} },
});

async function testIdleTask() {
  const state = createState();
  const runTask = createExecutor({});
  const result = await runTask(mockBot(), state, { taskId: 'idle', params: {}, reason: 'ok' });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.nextTask, null);
}

async function testInitStructureNoSkill() {
  const state = createState();
  const runTask = createExecutor({});
  const result = await runTask(mockBot(), state, { taskId: 'init_structure', params: {}, reason: 'bootstrap' });
  assert.strictEqual(result.success, true);
  assert.strictEqual(isCompleted(state, 'init_structure'), true);
}

async function testConnectNoSkill() {
  const state = createState();
  const runTask = createExecutor({});
  const result = await runTask(mockBot(), state, { taskId: 'connect', params: {}, reason: 'spawn' });
  assert.strictEqual(result.success, true);
  assert.strictEqual(isCompleted(state, 'connect'), true);
}

async function testSkillRun() {
  const state = createState();
  const runTask = createExecutor({ goto_test: movementSkill });
  const result = await runTask(mockBot(), state, { taskId: 'goto_test', params: { x: 0, y: 64, z: 0 }, reason: 'test' });
  assert.strictEqual(result.success, true);
  assert.strictEqual(isCompleted(state, 'goto_test'), true);
}

async function testUnknownTask() {
  const state = createState();
  const runTask = createExecutor({});
  const result = await runTask(mockBot(), state, { taskId: 'unknown_thing', params: {}, reason: 'x' });
  assert.strictEqual(result.success, false);
  assert.ok(result.reason.includes('Unknown'));
}

async function testClearPathfinderOnFailure() {
  let setGoalCalls = 0;
  const bot = {
    ...mockBot(),
    pathfinder: { goto: () => Promise.resolve(), setGoal: () => { setGoalCalls++; } },
  };
  const failingSkill = { run: () => Promise.resolve({ success: false, reason: 'fail' }) };
  const state = createState();
  const runTask = createExecutor({ fail_task: failingSkill });
  const result = await runTask(bot, state, { taskId: 'fail_task', params: {}, reason: 'test' });
  assert.strictEqual(result.success, false);
  assert.strictEqual(setGoalCalls, 1, 'Executor should clear pathfinder goal on task failure');
}

async function run() {
  await testIdleTask();
  await testInitStructureNoSkill();
  await testConnectNoSkill();
  await testSkillRun();
  await testUnknownTask();
  await testClearPathfinderOnFailure();
  console.log('executor.test.js: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
