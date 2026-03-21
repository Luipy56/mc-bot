#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState } = require('../lib/state');
const retry = require('../lib/retryPolicy');

function testRecordFailureAndCooldown() {
  const state = createState();
  const id = 'collect_wood';
  const max = retry.DEFAULT_MAX_FAILURES;
  for (let i = 0; i < max; i++) {
    retry.recordFailure(state, id);
  }
  assert.strictEqual(retry.isInCooldown(state, id), true);
  assert.ok(state.blackboard.taskCooldownUntil[id] > Date.now());
}

function testRecordSuccessClears() {
  const state = createState();
  retry.recordFailure(state, 'collect_wood');
  retry.recordFailure(state, 'collect_wood');
  retry.recordSuccess(state, 'collect_wood');
  assert.strictEqual(retry.getFailureCount(state, 'collect_wood'), 0);
  assert.strictEqual(retry.isInCooldown(state, 'collect_wood'), false);
}

function testExploreNoFailureTrack() {
  const state = createState();
  for (let i = 0; i < 10; i++) retry.recordFailure(state, 'explore_nearby');
  assert.strictEqual(retry.getFailureCount(state, 'explore_nearby'), 0);
}

function testIsGatherTask() {
  assert.strictEqual(retry.isGatherTask('collect_wood'), true);
  assert.strictEqual(retry.isGatherTask('goto_test'), true);
  assert.strictEqual(retry.isGatherTask('craft_planks'), false);
}

function run() {
  testRecordFailureAndCooldown();
  testRecordSuccessClears();
  testExploreNoFailureTrack();
  testIsGatherTask();
  console.log('retryPolicy.test.js: all passed');
}

run();
