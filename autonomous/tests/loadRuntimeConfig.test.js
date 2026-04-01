#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

function testDefaultYmlExists() {
  const p = path.join(__dirname, '..', 'config', 'default.yml');
  assert.ok(fs.existsSync(p), 'config/default.yml should exist');
}

function testInitAppliesTuning() {
  delete process.env.TASK_TIMEOUT_MS;
  require('../lib/loadRuntimeConfig').init();
  assert.ok(process.env.TASK_TIMEOUT_MS, 'YAML should set TASK_TIMEOUT_MS when unset');
  assert.strictEqual(parseInt(process.env.TASK_TIMEOUT_MS, 10), 120000);
}

function run() {
  testDefaultYmlExists();
  testInitAppliesTuning();
  console.log('loadRuntimeConfig.test.js: all passed');
}

run();
