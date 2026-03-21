#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState } = require('../lib/state');
const { criticalInterrupt, maybeExploreInstead } = require('../lib/brain');
const retry = require('../lib/retryPolicy');

function mockBot(overrides = {}) {
  return {
    food: 20,
    health: 20,
    entity: { position: { x: 0, y: 64, z: 0 } },
    inventory: { items: () => [] },
    registry: { itemsByName: {} },
    time: { isDay: true, timeOfDay: 6000 },
    entities: {},
    ...overrides,
  };
}

function testCriticalRetreat() {
  const state = createState();
  state.blackboard.nearHostiles = 2;
  const bot = mockBot({ health: 6 });
  const t = criticalInterrupt(state, bot);
  assert.strictEqual(t.taskId, 'retreat');
}

function testNoRetreatWhenSafe() {
  const state = createState();
  state.blackboard.nearHostiles = 0;
  const bot = mockBot({ health: 6 });
  const t = criticalInterrupt(state, bot);
  assert.strictEqual(t, null);
}

function testExploreWhenStuck() {
  const state = createState();
  const roadmap = { taskId: 'collect_wood', params: {}, reason: 'x' };
  retry.recordFailure(state, 'collect_wood');
  retry.recordFailure(state, 'collect_wood');
  const alt = maybeExploreInstead(state, roadmap);
  assert.strictEqual(alt.taskId, 'explore_nearby');
  assert.strictEqual(alt.params.forTask, 'collect_wood');
}

function testNoExploreWhenFresh() {
  const state = createState();
  const roadmap = { taskId: 'collect_wood', params: {}, reason: 'x' };
  const alt = maybeExploreInstead(state, roadmap);
  assert.strictEqual(alt, null);
}

function run() {
  testCriticalRetreat();
  testNoRetreatWhenSafe();
  testExploreWhenStuck();
  testNoExploreWhenFresh();
  console.log('brain.test.js: all passed');
}

run();
