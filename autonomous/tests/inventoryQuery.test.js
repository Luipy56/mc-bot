#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { countItems, hasItem } = require('../lib/inventoryQuery');

function testCountItemsSingle() {
  const bot = { inventory: { items: () => [{ name: 'oak_log', count: 4 }, { name: 'dirt', count: 2 }] } };
  assert.strictEqual(countItems(bot, 'oak_log'), 4);
  assert.strictEqual(countItems(bot, 'dirt'), 2);
  assert.strictEqual(countItems(bot, 'stone'), 0);
}

function testCountItemsArray() {
  const bot = { inventory: { items: () => [{ name: 'oak_log', count: 3 }, { name: 'birch_log', count: 2 }] } };
  assert.strictEqual(countItems(bot, ['oak_log', 'birch_log']), 5);
}

function testHasItem() {
  const bot = { inventory: { items: () => [{ name: 'stick', count: 4 }] } };
  assert.strictEqual(hasItem(bot, 'stick', 2), true);
  assert.strictEqual(hasItem(bot, 'stick', 10), false);
  assert.strictEqual(hasItem(bot, 'diamond'), false);
}

function testNullBot() {
  assert.strictEqual(countItems(null, 'x'), 0);
  assert.strictEqual(hasItem(null, 'x'), false);
}

function run() {
  testCountItemsSingle();
  testCountItemsArray();
  testHasItem();
  testNullBot();
  console.log('inventoryQuery.test.js: all passed');
}

run();
