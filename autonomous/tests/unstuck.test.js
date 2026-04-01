#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, setBlackboard } = require('../lib/state');
const {
  isPathLikeFailure,
  notePathOutcome,
  nextRecoveryTask,
  PATH_FAIL_STREAK_UNSTUCK,
  PATH_FAIL_STREAK_EXPLORE,
} = require('../lib/unstuck');
const { phaseForTask } = require('../lib/roadmapPhases');

function testPathLike() {
  assert.strictEqual(isPathLikeFailure('Path to block timed out'), true);
  assert.strictEqual(isPathLikeFailure('goto timeout'), true);
  assert.strictEqual(isPathLikeFailure('Need more wood'), false);
}

function testStreakAndRecovery() {
  const state = createState();
  notePathOutcome(state, 'collect_wood', false, 'Path to block timed out');
  assert.strictEqual(state.blackboard.pathStreak, 1);
  notePathOutcome(state, 'collect_wood', false, 'Path to block timed out');
  assert.strictEqual(state.blackboard.pathStreak, 2);
  let t = nextRecoveryTask(state);
  assert.strictEqual(t.taskId, 'unstuck_recover');

  notePathOutcome(state, 'unstuck_recover', true, 'ok');
  assert.strictEqual(state.blackboard.pathStreak, 0);

  for (let i = 0; i < PATH_FAIL_STREAK_EXPLORE; i++) {
    notePathOutcome(state, 'collect_wood', false, 'Path to block timed out');
  }
  t = nextRecoveryTask(state);
  assert.strictEqual(t.taskId, 'explore_nearby');
  assert.strictEqual(t.params.forTask, 'collect_wood');
}

function testChunkMissionNoExplore() {
  const state = createState();
  setBlackboard(state, 'chunkMission', { active: true, chunkX: 0, chunkZ: 0 });
  state.blackboard.pathStreak = PATH_FAIL_STREAK_EXPLORE;
  state.blackboard.lastPathTaskId = 'chunk_mission_step';
  const t = nextRecoveryTask(state);
  assert.strictEqual(t.taskId, 'unstuck_recover');
  assert.strictEqual(t.params.deep, true);
}

function testPhaseForUnstuck() {
  assert.strictEqual(phaseForTask('unstuck_recover'), 'recovery');
}

function run() {
  testPathLike();
  testStreakAndRecovery();
  testChunkMissionNoExplore();
  testPhaseForUnstuck();
  assert.ok(PATH_FAIL_STREAK_UNSTUCK >= 2);
  assert.ok(PATH_FAIL_STREAK_EXPLORE >= PATH_FAIL_STREAK_UNSTUCK);
  console.log('unstuck.test.js: all passed');
}

run();
