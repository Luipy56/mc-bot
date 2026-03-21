#!/usr/bin/env node
'use strict';

const assert = require('assert');
const weaponsSkill = require('../skills/weapons');

async function testEquipDiamondSword() {
  const bot = {
    inventory: {
      items: () => [{ name: 'diamond_sword', count: 1 }, { name: 'wooden_sword', count: 1 }],
    },
    equip: (item, slot) => {
      assert.strictEqual(item.name, 'diamond_sword');
      assert.strictEqual(slot, 'hand');
      return Promise.resolve();
    },
  };
  const r = await weaponsSkill.run(bot, {}, {});
  assert.strictEqual(r.success, true);
  assert.ok(r.reason.includes('diamond_sword'));
}

async function testNoWeapon() {
  const bot = {
    inventory: { items: () => [{ name: 'dirt', count: 1 }] },
    equip: () => { throw new Error('should not equip'); },
  };
  const r = await weaponsSkill.run(bot, {}, {});
  assert.strictEqual(r.success, true);
  assert.ok(r.reason.includes('No weapon'));
}

async function run() {
  await testEquipDiamondSword();
  await testNoWeapon();
  console.log('weapons.test.js: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
