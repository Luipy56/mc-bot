#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { createState, markCompleted } = require('../lib/state');
const { saveState, loadState } = require('../lib/persistence');

const testFile = path.join(__dirname, 'persistence-test-tmp.json');

function testSaveAndLoad() {
  const state = createState();
  markCompleted(state, 'connect');
  markCompleted(state, 'collect_wood');
  state.gameState.hasCraftingTable = true;
  state.blackboard.baseX = 10;

  saveState(state, testFile);
  assert.ok(fs.existsSync(testFile));
  const raw = fs.readFileSync(testFile, 'utf8');
  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data.progress));
  assert.ok(data.progress.includes('connect'));
  assert.strictEqual(data.gameState.hasCraftingTable, true);
  assert.strictEqual(data.blackboard.baseX, 10);

  const state2 = createState();
  loadState(state2, testFile);
  assert.ok(state2.progress.includes('connect'));
  assert.ok(state2.progress.includes('collect_wood'));
  assert.strictEqual(state2.gameState.hasCraftingTable, true);
  assert.strictEqual(state2.blackboard.baseX, 10);

  try { fs.unlinkSync(testFile); } catch (e) {}
}

function testLoadMissingFile() {
  const state = createState();
  loadState(state, path.join(__dirname, 'nonexistent-file-12345.json'));
  assert.strictEqual(state.progress.length, 0);
}

function run() {
  testSaveAndLoad();
  testLoadMissingFile();
  console.log('persistence.test.js: all passed');
}

run();
