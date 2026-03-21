#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const tests = [
  'state.test.js',
  'inventoryQuery.test.js',
  'perception.test.js',
  'planner.test.js',
  'executor.test.js',
  'skills-survival.test.js',
  'persistence.test.js',
  'executor-timeout.test.js',
  'situation.test.js',
  'weapons.test.js',
  'retryPolicy.test.js',
  'brain.test.js',
  'planner-roadmap.test.js',
  'kickReason.test.js',
  'combat.test.js',
  'buildWoodenHouse.test.js',
  'diamondCave.test.js',
  'advancements.test.js',
];

const dir = __dirname;
let failed = 0;

function runOne(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir, file)], {
      cwd: path.join(dir, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`FAIL ${file}: code ${code}`);
        if (err) console.error(err);
        if (out) console.error(out);
        failed++;
      } else {
        console.log(out.trim());
      }
      resolve();
    });
  });
}

async function main() {
  for (const file of tests) {
    await runOne(file);
  }
  if (failed > 0) {
    console.error(`\n${failed} test(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
