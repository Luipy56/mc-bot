#!/usr/bin/env node
'use strict';

const assert = require('assert');
const humanPlayer = require('../lib/humanPlayer');

async function testHuntingJitterBounds() {
  const prev = process.env.HUMAN_LIKE_PLAYER;
  process.env.HUMAN_LIKE_PLAYER = '1';
  try {
    for (let i = 0; i < 20; i++) {
      const d = humanPlayer.huntingAttackDelayMs(700);
      assert.ok(d >= 380 && d <= 980, d);
    }
  } finally {
    if (prev === undefined) delete process.env.HUMAN_LIKE_PLAYER;
    else process.env.HUMAN_LIKE_PLAYER = prev;
  }
}

async function testDisabledNoJitterChange() {
  const prev = process.env.HUMAN_LIKE_PLAYER;
  process.env.HUMAN_LIKE_PLAYER = '0';
  try {
    assert.strictEqual(humanPlayer.huntingAttackDelayMs(500), 500);
  } finally {
    if (prev === undefined) delete process.env.HUMAN_LIKE_PLAYER;
    else process.env.HUMAN_LIKE_PLAYER = prev;
  }
}

async function run() {
  await testHuntingJitterBounds();
  await testDisabledNoJitterChange();
  console.log('humanPlayer.test.js: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
