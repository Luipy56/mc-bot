#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, markCompleted, isCompleted, setBlackboard, getBlackboard } = require('../lib/state');

function testCreateState() {
  const state = createState();
  assert.ok(state.gameState);
  assert.strictEqual(state.gameState.phase, 'early');
  assert.ok(Array.isArray(state.progress));
  assert.ok(state.blackboard && typeof state.blackboard === 'object');
}

function testMarkAndIsCompleted() {
  const state = createState();
  assert.strictEqual(isCompleted(state, 'foo'), false);
  markCompleted(state, 'foo');
  assert.strictEqual(isCompleted(state, 'foo'), true);
  markCompleted(state, 'foo');
  assert.strictEqual(state.progress.length, 1);
}

function testBlackboard() {
  const state = createState();
  setBlackboard(state, 'basePos', { x: 10, y: 64, z: 20 });
  assert.deepStrictEqual(getBlackboard(state, 'basePos'), { x: 10, y: 64, z: 20 });
  assert.strictEqual(getBlackboard(state, 'missing'), undefined);
}

function run() {
  testCreateState();
  testMarkAndIsCompleted();
  testBlackboard();
  console.log('state.test.js: all passed');
}

run();
