#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { BLACKBOARD_KEYS } = require('../lib/blackboardSchema');

function testHasCoreKeys() {
  assert.ok(BLACKBOARD_KEYS.includes('spawnPos'));
  assert.ok(BLACKBOARD_KEYS.includes('strongholdTravelHint'));
  assert.ok(BLACKBOARD_KEYS.includes('chunkMission'));
}

function run() {
  testHasCoreKeys();
  console.log('blackboardSchema.test.js: all passed');
}

run();
