#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { rawDimension, isInNether, isInOverworld } = require('../lib/dimension');

function testNetherString() {
  const bot = { game: { dimension: 'minecraft:the_nether' } };
  assert.strictEqual(isInNether(bot), true);
  assert.strictEqual(isInOverworld(bot), false);
}

function testOverworldString() {
  const bot = { game: { dimension: 'minecraft:overworld' } };
  assert.strictEqual(isInNether(bot), false);
  assert.strictEqual(isInOverworld(bot), true);
}

function testEndNotNether() {
  const bot = { game: { dimension: 'minecraft:the_end' } };
  assert.strictEqual(isInNether(bot), false);
}

function testRawFallbackEntity() {
  const bot = { game: {}, entity: { dimension: 'the_nether' } };
  assert.ok(rawDimension(bot).toLowerCase().includes('nether'));
  assert.strictEqual(isInNether(bot), true);
}

function run() {
  testNetherString();
  testOverworldString();
  testEndNotNether();
  testRawFallbackEntity();
  console.log('dimension.test.js: all passed');
}

run();
