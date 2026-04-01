#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState } = require('../lib/state');
const {
  shouldAbortMiningBlock,
  NEVER_MINE_NAMES,
} = require('../lib/mineability');

function mockBotWithPicks(names) {
  return {
    inventory: {
      items: () => names.map((n) => ({ name: n, count: 1 })),
    },
  };
}

function testNeverMine() {
  const bot = mockBotWithPicks(['diamond_pickaxe']);
  assert.strictEqual(shouldAbortMiningBlock(bot, { name: 'bedrock' }).abort, true);
  assert.strictEqual(shouldAbortMiningBlock(bot, { name: 'barrier' }).abort, true);
  assert.strictEqual(shouldAbortMiningBlock(bot, { name: 'reinforced_deepslate' }).abort, true);
}

function testObsidianTooling() {
  const noDiamond = mockBotWithPicks(['iron_pickaxe']);
  const o = shouldAbortMiningBlock(noDiamond, { name: 'obsidian' });
  assert.strictEqual(o.abort, true);
  assert.strictEqual(o.kind, 'obsidian_pick');
  assert.ok(String(o.reason || '').includes('diamond'));

  const ok = mockBotWithPicks(['diamond_pickaxe']);
  assert.strictEqual(shouldAbortMiningBlock(ok, { name: 'obsidian' }).abort, false);
}

function testAncientDebris() {
  const bad = mockBotWithPicks(['iron_pickaxe']);
  const ad = shouldAbortMiningBlock(bad, { name: 'ancient_debris' });
  assert.strictEqual(ad.abort, true);
  assert.strictEqual(ad.kind, 'ancient_debris_pick');
  const good = mockBotWithPicks(['netherite_pickaxe']);
  assert.strictEqual(shouldAbortMiningBlock(good, { name: 'ancient_debris' }).abort, false);
}

function testSetSize() {
  assert.ok(NEVER_MINE_NAMES.has('bedrock'));
}

function run() {
  testNeverMine();
  testObsidianTooling();
  testAncientDebris();
  testSetSize();
  console.log('mineability.test.js: all passed');
}

run();
