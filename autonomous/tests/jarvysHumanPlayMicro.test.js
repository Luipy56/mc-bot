#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, setBlackboard } = require('../lib/state');
const { maybePickHumanMicroTask } = require('../lib/jarvysHumanPlayMicro');

function withEnv(updates, fn) {
  const keys = Object.keys(updates);
  const old = {};
  for (const k of keys) {
    old[k] = process.env[k];
    if (updates[k] === undefined || updates[k] === null) delete process.env[k];
    else process.env[k] = updates[k];
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
}

function testOffByDefault() {
  const prev = process.env.JARVYS_HUMAN_PLAY_MICRO;
  delete process.env.JARVYS_HUMAN_PLAY_MICRO;
  try {
    const state = createState();
    setBlackboard(state, 'nearHostiles', 0);
    const bot = { entity: { position: {} }, health: 20 };
    assert.strictEqual(maybePickHumanMicroTask(state, bot, 'collect_wood', true), null);
  } finally {
    if (prev !== undefined) process.env.JARVYS_HUMAN_PLAY_MICRO = prev;
  }
}

function testSkipsAfterRetreat() {
  withEnv(
    {
      JARVYS_HUMAN_PLAY_MICRO: '1',
      JARVYS_HUMAN_PLAY_MICRO_CHANCE: '1',
      JARVYS_HUMAN_PLAY_MICRO_COOLDOWN_MS: '0',
    },
    () => {
      const state = createState();
      setBlackboard(state, 'nearHostiles', 0);
      const bot = { entity: { position: {} }, health: 20 };
      assert.strictEqual(maybePickHumanMicroTask(state, bot, 'retreat', true), null);
    }
  );
}

function testPicksAndRespectsCooldown() {
  withEnv(
    {
      JARVYS_HUMAN_PLAY_MICRO: '1',
      JARVYS_HUMAN_PLAY_MICRO_CHANCE: '1',
      JARVYS_HUMAN_PLAY_MICRO_COOLDOWN_MS: '999999',
    },
    () => {
      const state = createState();
      setBlackboard(state, 'nearHostiles', 0);
      const bot = { entity: { position: {} }, health: 20 };
      const t = maybePickHumanMicroTask(state, bot, 'collect_wood', true);
      assert.ok(t && typeof t.taskId === 'string' && t.taskId.startsWith('human_human_'));
      const t2 = maybePickHumanMicroTask(state, bot, 'collect_wood', true);
      assert.strictEqual(t2, null);
    }
  );
}

function testSkipsWithHostiles() {
  withEnv(
    {
      JARVYS_HUMAN_PLAY_MICRO: '1',
      JARVYS_HUMAN_PLAY_MICRO_CHANCE: '1',
      JARVYS_HUMAN_PLAY_MICRO_COOLDOWN_MS: '0',
    },
    () => {
      const state = createState();
      setBlackboard(state, 'nearHostiles', 2);
      const bot = { entity: { position: {} }, health: 20 };
      assert.strictEqual(maybePickHumanMicroTask(state, bot, 'collect_wood', true), null);
    }
  );
}

function run() {
  testOffByDefault();
  testSkipsAfterRetreat();
  testPicksAndRespectsCooldown();
  testSkipsWithHostiles();
  console.log('jarvysHumanPlayMicro.test.js: all passed');
}

run();
