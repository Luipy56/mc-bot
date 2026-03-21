#!/usr/bin/env node
'use strict';

console.log('[Unit] combat: skill exports, no live server.');
const assert = require('assert');
const combat = require('../skills/combat');
assert.ok(typeof combat.run === 'function', 'run should be exported');
console.log('combat.test.js: all passed');
