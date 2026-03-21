#!/usr/bin/env node
'use strict';

console.log('[Unit] diamondCave: module exports and ore search list, no live server.');
const assert = require('assert');
const dc = require('../skills/diamondCave');

assert.strictEqual(typeof dc.run, 'function');
assert.ok(Array.isArray(dc.SEARCH_NAMES));
assert.ok(dc.SEARCH_NAMES.includes('diamond_ore'));

console.log('diamondCave.test.js: all passed');
