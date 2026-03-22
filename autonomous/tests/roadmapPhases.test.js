#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { phaseForTask, ROADMAP_PHASES } = require('../lib/roadmapPhases');
const { flattenPhasesToTaskOrder } = require('../lib/dagPlanner');

function testPhaseForKillDragon() {
  assert.strictEqual(phaseForTask('kill_ender_dragon'), 'endgame');
}

function testPhaseUnknown() {
  assert.strictEqual(phaseForTask('unknown_xyz'), 'other');
}

function testPhasesNonEmpty() {
  assert.ok(ROADMAP_PHASES.length >= 4);
}

function testFlattenOrder() {
  const flat = flattenPhasesToTaskOrder();
  assert.ok(flat.includes('kill_ender_dragon'));
}

function run() {
  testPhaseForKillDragon();
  testPhaseUnknown();
  testPhasesNonEmpty();
  testFlattenOrder();
  console.log('roadmapPhases.test.js: all passed');
}

run();
