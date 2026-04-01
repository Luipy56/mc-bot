#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, setBlackboard } = require('../lib/state');
const { nextChunkMissionTask } = require('../lib/chunkMissionBrain');
const {
  parseChunkStripChatMessage,
  blockToChunk,
  createChunkMissionFromPosition,
  requiredLadderCount,
  chunkOrigin,
} = require('../lib/chunkMissionState');
const { phaseForTask } = require('../lib/roadmapPhases');

function testParseChat() {
  assert.deepStrictEqual(parseChunkStripChatMessage('!chunkstrip'), { action: 'start' });
  assert.deepStrictEqual(parseChunkStripChatMessage('!picarchunk'), { action: 'start' });
  assert.deepStrictEqual(parseChunkStripChatMessage('!chunkstrip stop'), { action: 'stop' });
  assert.deepStrictEqual(parseChunkStripChatMessage('!picarchunk cancel'), { action: 'stop' });
  assert.strictEqual(parseChunkStripChatMessage('hello'), null);
}

function testBlockToChunk() {
  assert.deepStrictEqual(blockToChunk(32, -17), { chunkX: 2, chunkZ: -2 });
  assert.deepStrictEqual(blockToChunk(-1, -1), { chunkX: -1, chunkZ: -1 });
}

function testCreateMission() {
  const m = createChunkMissionFromPosition({ x: 32.2, y: 71, z: 15.9 }, { requester: 'alice' });
  assert.strictEqual(m.chunkX, 2);
  assert.strictEqual(m.chunkZ, 0);
  assert.strictEqual(m.requester, 'alice');
  assert.strictEqual(m.active, true);
  assert.strictEqual(m.phase, 'prep_gear');
  const co = chunkOrigin(m.chunkX, m.chunkZ);
  assert.strictEqual(co.minX, 32);
  assert.strictEqual(co.minZ, 0);
}

function testRequiredLadders() {
  const n = requiredLadderCount(80, -58);
  assert.ok(n >= 32);
  assert.ok(n <= 256);
}

function testBrainChunkMission() {
  const state = createState();
  assert.strictEqual(nextChunkMissionTask(state, null), null);
  setBlackboard(state, 'chunkMission', {
    active: true,
    chunkX: 0,
    chunkZ: 0,
    phase: 'strip',
    targetY: -58,
  });
  const t = nextChunkMissionTask(state, null);
  assert.strictEqual(t.taskId, 'chunk_mission_step');
  assert.ok(t.reason.includes('strip'));
  state.blackboard.chunkMission.active = false;
  assert.strictEqual(nextChunkMissionTask(state, null), null);
  state.blackboard.chunkMission.active = true;
  state.blackboard.chunkMission.phase = 'complete';
  assert.strictEqual(nextChunkMissionTask(state, null), null);
}

function testPhaseForTask() {
  assert.strictEqual(phaseForTask('chunk_mission_step'), 'chunk_mission');
}

function run() {
  testParseChat();
  testBlockToChunk();
  testCreateMission();
  testRequiredLadders();
  testBrainChunkMission();
  testPhaseForTask();
  console.log('chunkMission.test.js: all passed');
}

run();
