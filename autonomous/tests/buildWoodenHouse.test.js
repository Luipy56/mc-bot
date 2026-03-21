#!/usr/bin/env node
'use strict';

console.log('[Unit] buildWoodenHouse: floor/wall/roof layout (112 positions), no live server.');
const assert = require('assert');
const { buildPositionList, WIDTH, DEPTH, WALL_HEIGHT } = require('../skills/buildWoodenHouse');

const list = buildPositionList(0, 64, 0);
assert.strictEqual(list.length, 112, `expected 112 blocks (36 floor + 40 walls + 36 roof), got ${list.length}`);
assert.strictEqual(WIDTH, 6);
assert.strictEqual(DEPTH, 6);
assert.strictEqual(WALL_HEIGHT, 2);
const floor = list.filter((p) => p.y === 64);
assert.strictEqual(floor.length, 36);
const roof = list.filter((p) => p.y === 64 + WALL_HEIGHT + 1);
assert.strictEqual(roof.length, 36);

console.log('buildWoodenHouse.test.js: all passed');
