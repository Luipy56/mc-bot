#!/usr/bin/env node
'use strict';

/**
 * Run two bot instances with different names and state files so they can interact on the same server.
 * Uses .env for SERVER_IP/PORT/VERSION; overrides NAME and STATE_FILE per bot. Sets BOT_FRIENDS
 * so each bot greets the other (playerJoined + spawn) and replies to "hello"/"hi".
 *
 * Usage: node run-two-bots.js [name1] [name2]   (default: Jarvys, Jarvys2)
 * Or:    npm run two
 *
 * When both are online you should see chat like "Hi, Jarvys2!" / "Hi, Jarvys!". If the server
 * throttles connections, the second bot starts after 10s; increase the delay below if needed.
 * For servers that require AuthMe-style login, set MC_LOGIN_CMD (and MC_LOGIN_CHAT_DELAY_MS) in .env
 * so each process sends login before the public spawn line (see autonomous/bot.js).
 */
const { spawn } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const name1 = process.argv[2] || 'Jarvys';
const name2 = process.argv[3] || 'Jarvys2';

const baseEnv = { ...process.env };
const stateDir = __dirname;

function runBot(label, name, stateFile) {
  const env = {
    ...baseEnv,
    NAME: name,
    STATE_FILE: path.join(stateDir, stateFile),
    BOT_FRIENDS: [name1, name2].filter((n) => n !== name).join(','),
  };
  const child = spawn(process.execPath, [path.join(__dirname, 'bot.js')], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d.toString()}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d.toString()}`));
  child.on('close', (code, signal) => {
    console.log(`[${label}] exited code=${code} signal=${signal}`);
  });
  return child;
}

console.log(`Starting two bots: ${name1}, ${name2} (friends list set for both). Second bot starts in 10s to avoid connection throttle.`);
runBot(name1, name1, '.state-' + name1.toLowerCase() + '.json');
setTimeout(() => {
  runBot(name2, name2, '.state-' + name2.toLowerCase() + '.json');
}, 10000);
