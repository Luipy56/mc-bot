#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { capture } = require('../lib/perception');

function testCaptureFull() {
  const bot = {
    entity: { position: { x: 1.5, y: 64, z: -2.5 } },
    health: 20,
    food: 18,
    time: { timeOfDay: 6000, isDay: true },
    inventory: { items: () => [{ name: 'oak_log', count: 4 }] },
  };
  const snap = capture(bot);
  assert.ok(snap);
  assert.strictEqual(snap.position.x, 1.5);
  assert.strictEqual(snap.health, 20);
  assert.strictEqual(snap.food, 18);
  assert.strictEqual(snap.isDay, true);
  assert.strictEqual(snap.inventorySlots.length, 1);
  assert.strictEqual(snap.inventorySlots[0].name, 'oak_log');
  assert.strictEqual(snap.inventorySlots[0].count, 4);
}

function testCaptureNullBot() {
  assert.strictEqual(capture(null), null);
  assert.strictEqual(capture({}), null);
}

function testCaptureNoEntity() {
  const bot = { entity: null, health: 10 };
  assert.strictEqual(capture(bot), null);
}

function run() {
  testCaptureFull();
  testCaptureNullBot();
  testCaptureNoEntity();
  console.log('perception.test.js: all passed');
}

run();
