#!/usr/bin/env node
'use strict';

/**
 * Basic Mineflayer bot for Minecraft 1.21.x — ready for LAN server.
 * Uses env or defaults: HOST, PORT, USERNAME, VERSION, AUTH.
 */

require('dotenv').config();
const mineflayer = require('mineflayer');
const { exec } = require('child_process');
const os = require('os');

const PR_SSH_HOST = process.env.PR_SSH_HOST || '';
const PR_TIMEOUT_MS = parseInt(process.env.PR_TIMEOUT_MS || '60000', 10);
const MAX_CHAT_LEN = 256; // Minecraft chat limit
const RESTART_DELAY_MS = parseInt(process.env.JARVYS_RESTART_DELAY_MS || '5000', 10);

/** Run openclaw on PR_SSH_HOST and send stdout/stderr to chat in chunks. */
function runOpenclawViaSsh(message, bot) {
  if (!PR_SSH_HOST) {
    bot.chat('[pr] PR_SSH_HOST not set in .env');
    return;
  }
  const innerCmd = `openclaw agent --agent main --message ${JSON.stringify(message)}`;
  const home = process.env.HOME || os.homedir();
  const sshConfig = `${home}/.ssh/config`;
  const cmd = `ssh -F "${sshConfig}" -o BatchMode=yes ${PR_SSH_HOST} bash -lc ${JSON.stringify(innerCmd)}`;
  bot.chat(`[pr] Running on ${PR_SSH_HOST}...`);
  const execOpts = {
    timeout: PR_TIMEOUT_MS,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, HOME: home }
  };
  exec(cmd, execOpts, (err, stdout, stderr) => {
    const out = (stdout && stdout.trim()) || '';
    const stderrStr = (stderr && stderr.trim()) || '';
    let text = out;
    if (stderrStr) text = text ? `${text}\n${stderrStr}` : stderrStr;
    if (err) text = text ? `(${err.message}) ${text}` : err.message || 'Command failed.';
    if (!text) text = 'No output.';
    const lines = text.split(/\r?\n/).filter(Boolean);
    const toSend = [];
    let buf = '';
    for (const line of lines) {
      if (buf.length + line.length + 1 <= MAX_CHAT_LEN) {
        buf = buf ? `${buf}\n${line}` : line;
      } else {
        if (buf) toSend.push(buf);
        buf = line.length <= MAX_CHAT_LEN ? line : line.slice(0, MAX_CHAT_LEN);
      }
    }
    if (buf) toSend.push(buf);
    if (toSend.length === 0) toSend.push('No output.');
    toSend.slice(0, 10).forEach((chunk, i) => {
      setTimeout(() => { try { bot.chat(`[pr] ${chunk}`); } catch (e) { console.error(e); } }, i * 500);
    });
    if (toSend.length > 10) {
      setTimeout(() => { try { bot.chat(`[pr] ... (${toSend.length - 10} more chunks)`); } catch (e) {} }, 10 * 500);
    }
    if (err) console.error('[pr]', err.message);
  });
}

// Server config from .env (see .env.example)
const config = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: process.env.MC_USERNAME,
  version: process.env.MC_VERSION || '1.21.11',
  auth: process.env.MC_AUTH || 'offline'
};
if (!config.username) {
  console.error('[Bot] Set MC_USERNAME in .env (copy from .env.example)');
  process.exit(1);
}

function createBot() {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: config.auth
  });

  bot.on('login', () => {
    console.log(`[Bot] Logging in as ${config.username} → ${config.host}:${config.port} (${config.version})`);
  });

  bot.on('spawn', () => {
    console.log(`[Bot] Spawned at ${bot.entity.position}`);
    bot.chat('Hello! Mineflayer bot online.');
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log(`[Chat] <${username}> ${message}`);
    const raw = message.trim();
    const lower = raw.toLowerCase();
    // Ping / pong
    if (lower === 'ping') {
      bot.chat('pong');
      return;
    }
    // Jarvys assistant: !pr, !time, !players, !health
    if (lower.startsWith('!')) {
      if (lower.startsWith('!pr ')) {
        const msg = raw.slice(4).trim();
        if (msg) runOpenclawViaSsh(msg, bot);
        else bot.chat('[pr] Usage: !pr <message>');
        return;
      }
      const cmd = lower.slice(1).split(/\s+/)[0];
      if (cmd === 'time') {
        const timeOfDay = bot.time?.timeOfDay ?? 0;
        const phase = bot.time?.isDay ? 'Day' : 'Night';
        const pos = bot.entity?.position;
        const posStr = pos ? ` @ (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})` : '';
        bot.chat(`${phase} (${timeOfDay} ticks)${posStr}`);
      } else if (cmd === 'players') {
        const names = Object.keys(bot.players || {}).filter((n) => n !== bot.username);
        bot.chat(names.length ? `Online: ${names.join(', ')}` : 'No other players online.');
      } else if (cmd === 'health' || cmd === 'status') {
        const h = bot.health ?? '?';
        const f = bot.food ?? '?';
        bot.chat(`Health: ${h} | Food: ${f}`);
      }
    }
  });

  bot.on('kicked', (reason) => {
    console.log('[Bot] Kicked:', reason);
  });

  bot.on('error', (err) => {
    console.error('[Bot] Error:', err.message);
    if (err.stack) console.error('[Bot] Stack:', err.stack);
  });

  bot.on('end', (reason) => {
    console.log('[Bot] Disconnected:', reason || 'unknown');
    console.log('[Bot] Restarting in 3s...');
    setTimeout(createBot, 3000);
  });

  return bot;
}

createBot();
