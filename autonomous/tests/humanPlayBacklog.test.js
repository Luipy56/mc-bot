#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Vec3 = require('vec3');
const { HANDLERS } = require('../skills/extendedPlayerDispatch');
const { HUMAN_PLAY_TASK_IDS } = require('../lib/humanPlayTaskIds');

function makeMockBot() {
  return {
    entity: {
      position: new Vec3(0, 64, 0),
      yaw: 0,
      pitch: 0,
    },
    username: 'testbot',
    inventory: { items: () => [] },
    findBlock: () => null,
    nearestEntity: () => null,
    pathfinder: null,
    fish: undefined,
    look: async () => {},
    lookAt: async () => {},
    equip: async () => {},
    entities: {},
  };
}

async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function testEveryHumanPlayHandlerReturns() {
  const mockState = { blackboard: {} };
  const mockBot = makeMockBot();
  for (const id of HUMAN_PLAY_TASK_IDS) {
    const fn = HANDLERS[id];
    assert.strictEqual(typeof fn, 'function', `missing handler for ${id}`);
    const result = await withTimeout(
      fn(mockBot, mockState, { _taskId: id }),
      4000,
      id
    );
    assert.ok(result && typeof result.success === 'boolean', `${id} bad result shape`);
  }
}

async function testCatalogCoversTaskIds() {
  const { SKILL_CATALOG } = require('../lib/playerSkillCatalog');
  const catalogIds = new Set(SKILL_CATALOG.map((e) => e.id));
  for (const id of HUMAN_PLAY_TASK_IDS) {
    assert.ok(catalogIds.has(id), `catalog missing ${id}`);
  }
}

async function run() {
  await testEveryHumanPlayHandlerReturns();
  await testCatalogCoversTaskIds();
  console.log('humanPlayBacklog.test.js: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
