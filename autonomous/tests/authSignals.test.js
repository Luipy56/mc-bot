#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { detectAuthSignal } = require('../lib/authSignals');

assert.strictEqual(detectAuthSignal('Wrong password!'), 'wrong_password');
assert.strictEqual(detectAuthSignal('Please /register your account'), 'needs_register');
assert.strictEqual(detectAuthSignal("This user isn't registered!"), 'needs_register');
assert.strictEqual(detectAuthSignal('You have exceeded the maximum number of registrations'), 'register_blocked');
assert.strictEqual(detectAuthSignal('You must use /login <password>'), 'needs_login');
assert.strictEqual(detectAuthSignal('In order to chat you must be authenticated!'), 'needs_login');
assert.strictEqual(detectAuthSignal('Login successful, welcome back!'), 'login_ok');
assert.strictEqual(detectAuthSignal('Successful login!'), 'login_ok');
assert.strictEqual(detectAuthSignal('Normal chat line'), null);

console.log('authSignals.test.js: all passed');
