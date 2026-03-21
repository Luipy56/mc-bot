#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, isCompleted, markCompleted } = require('../lib/state');
const { countNearbyHostiles, syncProgressFromInventory, updateSituation } = require('../lib/situation');

function testCountHostiles() {
  const pos = {};
  const bot = {
    entity: { position: pos },
    entities: {
      1: { name: 'zombie', position: { distanceTo: () => 5 } },
      2: { name: 'cow', position: { distanceTo: () => 3 } },
      3: { name: 'creeper', position: { distanceTo: () => 25 } },
    },
  };
  assert.strictEqual(countNearbyHostiles(bot, 20), 1);
  assert.strictEqual(countNearbyHostiles(bot, 10), 1);
  assert.strictEqual(countNearbyHostiles(bot, 30), 2);
}

function testSyncSkipsCollectWood() {
  const state = createState();
  ['init_structure', 'connect', 'goto_test'].forEach((id) => markCompleted(state, id));
  const bot = {
    inventory: {
      items: () => [
        { name: 'oak_log', count: 10 },
      ],
    },
  };
  syncProgressFromInventory(state, bot);
  assert.strictEqual(isCompleted(state, 'collect_wood'), true);
}

function testSyncSkipsCraftPlanks() {
  const state = createState();
  const bot = {
    inventory: { items: () => [{ name: 'oak_planks', count: 8 }] },
  };
  syncProgressFromInventory(state, bot);
  assert.strictEqual(isCompleted(state, 'craft_planks'), true);
}

function testUpdateSituation() {
  const state = createState();
  const bot = {
    entity: { position: { x: 1.2, y: 64, z: -3.4 } },
    entities: {},
    time: { isDay: false, timeOfDay: 18000 },
  };
  updateSituation(bot, state);
  assert.strictEqual(state.blackboard.nearHostiles, 0);
  assert.strictEqual(state.blackboard.isDay, false);
  assert.strictEqual(state.blackboard.lastPos.x, 1);
}

function run() {
  testCountHostiles();
  testSyncSkipsCollectWood();
  testSyncSkipsCraftPlanks();
  testUpdateSituation();
  console.log('situation.test.js: all passed');
}

run();
