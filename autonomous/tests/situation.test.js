#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, isCompleted, markCompleted } = require('../lib/state');
const { countNearbyHostiles, countNearbyPassiveFoodMobs, syncProgressFromInventory, updateSituation } = require('../lib/situation');

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

function testCountPassiveFoodMobs() {
  const pos = {};
  const bot = {
    entity: { position: pos },
    entities: {
      1: { name: 'cow', position: { distanceTo: () => 4 } },
      2: { name: 'pig', position: { distanceTo: () => 7 } },
      3: { name: 'zombie', position: { distanceTo: () => 5 } },
    },
  };
  assert.strictEqual(countNearbyPassiveFoodMobs(bot, 10), 2);
  assert.strictEqual(countNearbyPassiveFoodMobs(bot, 5), 1);
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
  assert.strictEqual(state.blackboard.nearPassiveFood, 0);
  assert.strictEqual(state.blackboard.hasFoodInInventory, false);
  assert.strictEqual(state.blackboard.isDay, false);
  assert.strictEqual(state.blackboard.lastPos.x, 1);
}

function run() {
  testCountHostiles();
  testCountPassiveFoodMobs();
  testSyncSkipsCollectWood();
  testSyncSkipsCraftPlanks();
  testUpdateSituation();
  console.log('situation.test.js: all passed');
}

run();
