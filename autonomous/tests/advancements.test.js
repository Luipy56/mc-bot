#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, markCompleted } = require('../lib/state');
const { getCompleted, getIncomplete, getNextTaskForAdvancement, ADVANCEMENTS } = require('../lib/advancements');

const state = createState();
assert.ok(ADVANCEMENTS.length >= 10);
assert.strictEqual(getCompleted(state, null).length, 0);
assert.strictEqual(getIncomplete(state, null).length, ADVANCEMENTS.length);

markCompleted(state, 'collect_cobblestone');
markCompleted(state, 'craft_stone_pick');
const done = getCompleted(state, null);
assert.ok(done.length >= 2);
assert.ok(done.some((a) => a.id === 'minecraft:story/mine_stone'));
assert.ok(done.some((a) => a.id === 'minecraft:story/upgrade_tools'));

const next = getNextTaskForAdvancement(state, null);
assert.ok(next === null || (next.taskId && next.advancement));

console.log('advancements.test.js: all passed');
