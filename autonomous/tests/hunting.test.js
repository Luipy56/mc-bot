#!/usr/bin/env node
'use strict';

process.env.HUNT_TIMEOUT_MS = process.env.HUNT_TIMEOUT_MS || '900';
process.env.HUNT_ATTACK_INTERVAL_MS = process.env.HUNT_ATTACK_INTERVAL_MS || '20';
process.env.HUNT_PICKUP_WAIT_MS = process.env.HUNT_PICKUP_WAIT_MS || '20';

const assert = require('assert');
const hunting = require('../skills/hunting');

async function testNeedsPathfinder() {
  const res = await hunting.run({}, {}, {});
  assert.strictEqual(res.success, false);
}

async function testHuntCowAndEat() {
  const inv = [];
  const target = {
    name: 'cow',
    isValid: true,
    position: {
      distanceTo: () => 2,
      offset: () => ({ x: 0, y: 0, z: 0 }),
    },
  };

  const bot = {
    food: 6,
    entity: { position: { x: 0, y: 64, z: 0 } },
    entities: { 1: target },
    pathfinder: { setGoal: () => {} },
    inventory: { items: () => inv },
    lookAt: async () => {},
    attack: async (e) => {
      e.isValid = false;
      inv.push({ name: 'beef', count: 1 });
    },
    equip: async () => {},
    consume: async () => { bot.food = 20; },
  };
  const state = { blackboard: {} };
  const res = await hunting.run(bot, state, { maxDistance: 20, minMeat: 1, eatBelow: 15 });
  assert.strictEqual(res.success, true);
  assert.ok(inv.some((i) => i.name === 'beef'));
  assert.ok(bot.food >= 20, 'bot should eat after hunting when hungry');
}

async function run() {
  await testNeedsPathfinder();
  await testHuntCowAndEat();
  console.log('hunting.test.js: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
