#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState } = require('../lib/state');
const { createExecutor } = require('../lib/executor');

const slowSkill = {
  run: () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 500)),
};

async function testTaskTimesOut() {
  const state = createState();
  const runTask = createExecutor({ slow_task: slowSkill }, { taskTimeoutMs: 100 });
  const result = await runTask(
    { entity: {}, inventory: { items: () => [] }, health: 20, food: 20, time: {} },
    state,
    { taskId: 'slow_task', params: {}, reason: 'test' }
  );
  assert.strictEqual(result.success, false);
  assert.ok(result.reason.includes('timed out'));
}

async function run() {
  await testTaskTimesOut();
  console.log('executor-timeout.test.js: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
