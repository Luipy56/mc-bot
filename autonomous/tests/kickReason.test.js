#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { formatKickReason, kickNeedsSlowReconnect } = require('../lib/kickReason');

assert.strictEqual(
  formatKickReason('{"text":"The same username is already playing on the server!","color":"dark_red"}'),
  'The same username is already playing on the server!'
);
assert.strictEqual(formatKickReason('plain kick'), 'plain kick');
assert.strictEqual(kickNeedsSlowReconnect('Connection throttled!'), true);
assert.strictEqual(kickNeedsSlowReconnect('The same username is already playing on the server!'), true);
assert.strictEqual(kickNeedsSlowReconnect('Banned: grief'), false);
assert.strictEqual(kickNeedsSlowReconnect('Login timeout exceeded, you have been kicked from the server, please try again!'), true);

const compoundWithExtra = { type: 'compound', value: { extra: { value: [{ text: { type: 'string', value: 'Login timeout exceeded.' } }] } } };
assert.strictEqual(formatKickReason(compoundWithExtra), 'Login timeout exceeded.');

console.log('kickReason.test.js: all passed');
