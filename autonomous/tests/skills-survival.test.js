#!/usr/bin/env node
'use strict';

const assert = require('assert');
const survivalSkill = require('../skills/survival');

async function testEatWhenLowFood() {
  const bot = {
    food: 5,
    health: 20,
    inventory: { items: () => [{ name: 'bread', count: 2 }] },
    equip: () => Promise.resolve(),
    consume: () => Promise.resolve(),
  };
  const state = {};
  const result = await survivalSkill.run(bot, state, { minFood: 10 });
  assert.strictEqual(result.success, true);
  assert.ok(result.reason);
}

async function testNoEatWhenEnoughFood() {
  const bot = {
    food: 18,
    health: 20,
    inventory: { items: () => [] },
  };
  const result = await survivalSkill.run(bot, {}, { minFood: 10 });
  assert.strictEqual(result.success, true);
  assert.ok(result.reason.includes('OK') || result.reason.includes('Food'));
}

async function testNoFoodInInventory() {
  const bot = {
    food: 5,
    health: 20,
    inventory: { items: () => [{ name: 'dirt', count: 64 }] },
  };
  const result = await survivalSkill.run(bot, {}, { minFood: 10 });
  assert.strictEqual(result.success, false);
  assert.ok(result.reason.includes('food') || result.reason.includes('No'));
}

async function run() {
  await testEatWhenLowFood();
  await testNoEatWhenEnoughFood();
  await testNoFoodInInventory();
  console.log('skills-survival.test.js: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
