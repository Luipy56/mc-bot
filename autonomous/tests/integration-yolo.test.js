#!/usr/bin/env node
'use strict';

/**
 * Live server smoke test: run the real autonomous bot briefly and assert console shows
 * login and task-loop activity. If server auth blocks chat/tasks, fail with explicit reason.
 *
 * Requires a reachable Minecraft server and NAME or MC_USERNAME (and host) in .env.
 * Run: npm run test:yolo   or   node tests/run-all.js --yolo
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

const name = process.env.NAME || process.env.MC_USERNAME;
const host = process.env.SERVER_IP || process.env.MC_HOST;

if (process.env.YOLO !== '1') {
  console.log('integration-yolo.test.js: skipped (enabled via npm run test:yolo or run-all.js --yolo)');
  process.exit(0);
}

if (!name || !host) {
  console.error('integration-yolo.test.js: set NAME (or MC_USERNAME) and SERVER_IP (or MC_HOST) in autonomous/.env');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const timeoutMs = parseInt(process.env.YOLO_TIMEOUT_MS || '22000', 10);
const botJs = path.join(root, 'bot.js');

let out = '';
let err = '';

const child = spawn(process.execPath, [botJs], {
  cwd: root,
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (d) => { out += d.toString(); });
child.stderr.on('data', (d) => { err += d.toString(); });

const t = setTimeout(() => {
  child.kill('SIGTERM');
}, timeoutMs);

child.on('close', (code, signal) => {
  clearTimeout(t);
  const log = `${out}\n${err}`;
  try {
    const hasLoginCmd =
      Boolean((process.env.MC_LOGIN_CMD || '').trim()) ||
      Boolean((process.env.MC_AUTH_PASSWORD || '').trim()) ||
      Boolean((process.env.MC_AUTHME_PASSWORD || '').trim()) ||
      Boolean((process.env.MC_LOGIN_PASSWORD || '').trim());

    if (/must wait .*before logging-in again|connection throttled/i.test(log)) {
      throw new Error(`server is throttling reconnect attempts; wait and retry YOLO test.\n${log.slice(0, 2000)}`);
    }
    if (/maximum number of registrations|too many registrations/i.test(log)) {
      throw new Error(`server blocked new account registration for this connection; use existing account credentials.\n${log.slice(0, 2000)}`);
    }

    assert.ok(
      log.includes('[Bot] Logging in'),
      `expected stdout to include [Bot] Logging in — got:\n${log.slice(0, 2000)}`
    );

    if (/wrong password/i.test(log)) {
      throw new Error(`auth failed: server reported wrong password. Fix MC_LOGIN_CMD/MC_AUTH_PASSWORD.\n${log.slice(0, 2000)}`);
    }

    const authPromptSeen = /please,\s*login with the command:\s*\/login/i.test(log) || log.includes('Login required by server');
    if (authPromptSeen && !hasLoginCmd) {
      throw new Error(`server requires /login but no auth credentials configured in autonomous/.env.\n${log.slice(0, 2000)}`);
    }

    assert.ok(
      log.includes('[Bot] Chat:'),
      `expected [Bot] Chat: (public chat is logged) — got:\n${log.slice(0, 2000)}`
    );
    const customGreet = (process.env.MC_SPAWN_CHAT || '').trim();
    if (customGreet) {
      assert.ok(
        log.includes(customGreet),
        `expected MC_SPAWN_CHAT in log — got:\n${log.slice(0, 2000)}`
      );
    } else {
      assert.ok(
        log.includes('0/'),
        `expected default spawn greeting — got:\n${log.slice(0, 2000)}`
      );
    }
    assert.ok(
      log.includes('[Agent] Task:'),
      `expected task loop log [Agent] Task: — got:\n${log.slice(0, 2000)}`
    );
    console.log('integration-yolo.test.js: all passed (saw login + chat log + agent task)');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    if (!log.trim()) {
      console.error('(no output — is the server running and is .env correct?)');
    }
    process.exit(1);
  }
});
