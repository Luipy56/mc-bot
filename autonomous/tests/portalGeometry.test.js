#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { MINIMAL_PORTAL_SLOTS } = require('../lib/netherPortal');

function testMinimalSlotCount() {
  assert.strictEqual(MINIMAL_PORTAL_SLOTS.length, 10, 'minimal portal uses 10 obsidian');
}

function testSlotBounds() {
  for (const [u, v] of MINIMAL_PORTAL_SLOTS) {
    assert.ok(u >= 0 && u <= 4 && v >= 0 && v <= 3, `slot ${u},${v} in frame`);
  }
}

function run() {
  testMinimalSlotCount();
  testSlotBounds();
  console.log('portalGeometry.test.js: all passed');
}

run();
