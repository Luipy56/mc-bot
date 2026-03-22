#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Vec3 = require('vec3');
const { yawToForwardXZ, mergeDirections, extrapolateXZ } = require('../lib/strongholdTriangulation');

function testYawNorth() {
  const f = yawToForwardXZ(0);
  assert.ok(Math.abs(f.z - 1) < 1e-6, 'yaw 0 → +Z');
}

function testMerge() {
  const a = { x: 1, z: 0 };
  const b = { x: 1, z: 0 };
  const m = mergeDirections(a, b);
  assert.ok(Math.abs(m.x - 1) < 1e-6);
}

function testExtrapolate() {
  const p = extrapolateXZ(new Vec3(0, 64, 0), { x: 1, z: 0 }, 10);
  assert.strictEqual(Math.round(p.x), 10);
  assert.strictEqual(Math.round(p.y), 64);
}

function run() {
  testYawNorth();
  testMerge();
  testExtrapolate();
  console.log('strongholdTriangulation.test.js: all passed');
}

run();
