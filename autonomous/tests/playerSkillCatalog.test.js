#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { SKILL_CATALOG, catalogStats, catalogIds } = require('../lib/playerSkillCatalog');
const { buildExtraPlayerSkills } = require('../lib/extraPlayerSkills');
const { HANDLERS } = require('../skills/extendedPlayerDispatch');

function testNoDuplicateIds() {
  const seen = new Set();
  for (const e of SKILL_CATALOG) {
    assert.ok(!seen.has(e.id), `duplicate catalog id: ${e.id}`);
    seen.add(e.id);
  }
}

function testStatuses() {
  const stats = catalogStats();
  assert.ok(stats.total >= 150);
  assert.ok(stats.byStatus.core >= 70);
  assert.ok(stats.byStatus.extended >= 80);
  assert.ok(stats.byStatus['live-addon'] >= 10);
}

function testCatalogIdsMatchesLength() {
  assert.strictEqual(catalogIds().length, SKILL_CATALOG.length);
}

function testEveryExtendedHasHandler() {
  const ext = SKILL_CATALOG.filter((e) => e.status === 'extended').map((e) => e.id);
  const missing = ext.filter((id) => typeof HANDLERS[id] !== 'function');
  assert.strictEqual(missing.length, 0, `Missing handlers: ${missing.join(', ')}`);
}

function testExtraSkillsMerge() {
  const craftingSkill = { run: async () => ({ success: false }) };
  const miningSkill = { run: async () => ({ success: false }) };
  const smeltingSkill = { run: async () => ({ success: false }) };
  const existing = new Set(['goto_test', 'craft_bread']);
  const extra = buildExtraPlayerSkills({
    craftingSkill,
    miningSkill,
    smeltingSkill,
    existingIds: existing,
  });
  assert.ok(extra.fish_for_food);
  assert.ok(extra.collect_grass_seeds);
  assert.strictEqual(extra.craft_bread, undefined, 'skip ids already in base map');
}

function run() {
  testNoDuplicateIds();
  testStatuses();
  testCatalogIdsMatchesLength();
  testEveryExtendedHasHandler();
  testExtraSkillsMerge();
  console.log('playerSkillCatalog.test.js: all passed');
}

run();
