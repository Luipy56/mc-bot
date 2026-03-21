#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mining = require('../skills/mining');

async function testProtectedAreaFastFail() {
  const bot = {
    pathfinder: {},
    entity: { position: { x: 0, y: 64, z: 0 } },
    inventory: { items: () => [] },
    findBlock: () => null,
  };
  const state = { blackboard: { regionProtected: true } };
  const res = await mining.run(bot, state, { blockName: 'oak_log', count: 1 });
  assert.strictEqual(res.success, false);
  assert.ok(res.reason.includes('Protected area'));
}

testProtectedAreaFastFail()
  .then(() => console.log('mining.test.js: all passed'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
