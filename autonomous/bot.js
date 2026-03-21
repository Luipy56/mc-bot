#!/usr/bin/env node
'use strict';

/**
 * Autonomous Mineflayer bot — goal: complete the game (Ender Dragon).
 * Config from .env: NAME/SERVER_IP/PORT/VERSION or MC_*.
 * Loads pathfinder and runs task loop after spawn.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;

const { getConfig } = require('./lib/config');
const { createState, markCompleted, isCompleted, setBlackboard } = require('./lib/state');
const { nextTask } = require('./lib/brain');
const { createExecutor } = require('./lib/executor');
const { loadState, saveState } = require('./lib/persistence');
const { formatKickReason, kickNeedsSlowReconnect } = require('./lib/kickReason');
const { detectAuthSignal } = require('./lib/authSignals');
const { getCompleted, getIncomplete, getNextTaskForAdvancement } = require('./lib/advancements');
const movementSkill = require('./skills/movement');
const miningSkill = require('./skills/mining');
const craftingSkill = require('./skills/crafting');
const survivalSkill = require('./skills/survival');
const buildingSkill = require('./skills/building');
const netherSkill = require('./skills/nether');
const endSkill = require('./skills/end');
const sleepSkill = require('./skills/sleep');
const armorSkill = require('./skills/armor');
const weaponsSkill = require('./skills/weapons');
const exploreSkill = require('./skills/explore');
const retreatSkill = require('./skills/retreat');
const smeltingSkill = require('./skills/smelting');
const craftHousePlanksSkill = require('./skills/craftHousePlanks');
const buildWoodenHouseSkill = require('./skills/buildWoodenHouse');
const huntingSkill = require('./skills/hunting');

const combatSkill = require('./skills/combat');
const diamondCaveSkill = require('./skills/diamondCave');
const config = getConfig();

const skills = {
  goto_test: movementSkill,
  collect_wood: miningSkill,
  collect_cobblestone: miningSkill,
  collect_more_wood: miningSkill,
  collect_coal: miningSkill,
  hunt_food: huntingSkill,
  collect_obsidian: miningSkill,
  craft_planks: craftingSkill,
  craft_sticks: craftingSkill,
  craft_crafting_table: craftingSkill,
  craft_wood_pick: craftingSkill,
  craft_stone_pick: craftingSkill,
  craft_chest: craftingSkill,
  craft_furnace: craftingSkill,
  craft_bed: craftingSkill,
  eat_if_needed: survivalSkill,
  place_crafting_table: buildingSkill,
  place_bed: buildingSkill,
  place_chest: buildingSkill,
  collect_wood_for_house: miningSkill,
  craft_house_planks: craftHousePlanksSkill,
  build_wooden_house: buildWoodenHouseSkill,
  sleep_in_bed: sleepSkill,
  equip_armor: armorSkill,
  equip_weapon: weaponsSkill,
  place_furnace: buildingSkill,
  collect_iron_ore: miningSkill,
  smelt_iron_ingots: smeltingSkill,
  craft_iron_pickaxe: craftingSkill,
  craft_stone_shovel: craftingSkill,
  collect_gravel_for_flint: miningSkill,
  craft_flint_and_steel: craftingSkill,
  collect_diamond_ore: diamondCaveSkill,
  craft_diamond_pickaxe: craftingSkill,
  explore_nearby: exploreSkill,
  retreat: retreatSkill,
  build_nether_portal: netherSkill,
  enter_nether: netherSkill,
  collect_blaze_rods: netherSkill,
  collect_ender_pearls: netherSkill,
  craft_blaze_powder: craftingSkill,
  craft_eyes_of_ender: endSkill,
  find_stronghold: endSkill,
  enter_end: endSkill,
  kill_ender_dragon: endSkill,
  kill_enemy: combatSkill,
};

const state = createState();
loadState(state);
if (!isCompleted(state, 'init_structure')) markCompleted(state, 'init_structure');
const runTask = createExecutor(skills, { taskTimeoutMs: parseInt(process.env.TASK_TIMEOUT_MS || '120000', 10) });

let bot;
/** True while an autonomous iteration is in progress (prevents parallel runTask). */
let loopRunning = false;
let lastKickReason = '';
const taskFailRetryMs = parseInt(process.env.TASK_FAIL_RETRY_MS || '2500', 10);
let lastRtpSearchAt = 0;
const RTP_SEARCH_COOLDOWN_MS = parseInt(process.env.RTP_SEARCH_COOLDOWN_MS || '180000', 10);
const thinkDelayMinMs = parseInt(process.env.PLAYER_THINK_MIN_MS || '350', 10);
const thinkDelayMaxMs = parseInt(process.env.PLAYER_THINK_MAX_MS || '1100', 10);
const humanActionMinMs = parseInt(process.env.HUMAN_ACTION_MIN_MS || '18000', 10);
const humanActionMaxMs = parseInt(process.env.HUMAN_ACTION_MAX_MS || '36000', 10);
const authCmdCooldownMs = parseInt(process.env.AUTH_CMD_COOLDOWN_MS || '4000', 10);
const protectedClearDist = parseInt(process.env.PROTECTED_ZONE_CLEAR_DIST || '80', 10);
const allow1by1Towers = parseBool(process.env.ALLOW_1BY1_TOWERS, false);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  const lo = Number.isFinite(min) ? Math.floor(min) : 0;
  const hi = Number.isFinite(max) ? Math.floor(max) : lo;
  if (hi <= lo) return Math.max(0, lo);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function maybeTriggerRtpSearch(task, result) {
  if (!bot || !task || !result || result.success) return;
  const enabled = parseBool(process.env.BIRCH_HOUSE_USE_RTP, true);
  if (!enabled) return;
  const now = Date.now();
  if (now - lastRtpSearchAt < RTP_SEARCH_COOLDOWN_MS) return;

  const reason = String(result.reason || '').toLowerCase();
  const isBirchMission = String(process.env.HOUSE_PLANK_NAME || '').toLowerCase() === 'birch_planks';
  const birchStuck = isBirchMission && task.taskId === 'collect_wood_for_house' && reason.includes('no birch_log found');
  const hungerStuck = task.taskId === 'hunt_food' && reason.includes('no passive food mobs nearby');
  if (!birchStuck && !hungerStuck) return;

  lastRtpSearchAt = now;
  try {
    bot.chat('/rtp');
    console.log('[Bot] Command: /rtp (search new area)');
  } catch (e) {
    console.error('[Bot] /rtp failed:', e.message);
  }
}

/**
 * Start the autonomous task loop if not already running. Safe to call from spawn, respawn, etc.
 * Pattern: single async runner (like a coroutine) — avoids releasing the lock before await, which
 * caused overlapping tasks. On task failure we backoff and continue (brain may switch to explore).
 */
function scheduleLoop() {
  if (loopRunning || !bot) return;
  loopRunning = true;
  setImmediate(() => {
    (async () => {
      try {
        while (bot && bot.entity) {
          if (bot.isAlive === false) {
            console.log('[Agent] Loop paused (dead); resumes on respawn.');
            break;
          }
          if (state.blackboard?.authRequired && !state.blackboard?.authReady) {
            await sleep(1200);
            continue;
          }
          const thinkMs = randomBetween(thinkDelayMinMs, thinkDelayMaxMs);
          if (thinkMs > 0) {
            await sleep(thinkMs);
            if (!bot || !bot.entity || bot.isAlive === false) break;
          }
          const task = nextTask(state, bot);
          console.log('[Agent] Task:', task.taskId, '—', task.reason);
          const result = await runTask(bot, state, task);
          console.log('[Agent] Result:', result.success ? 'ok' : 'fail', result.reason);
          maybeTriggerRtpSearch(task, result);
          saveState(state);
          if (task.taskId === 'idle') break;
          if (!bot || !bot.entity || bot.isAlive === false) break;
          await sleep(randomBetween(200, 900));
          if (!result.success && taskFailRetryMs > 0) {
            await sleep(taskFailRetryMs);
          }
        }
      } catch (err) {
        console.error('[Agent] Loop error:', err.message || err);
        saveState(state);
      } finally {
        loopRunning = false;
      }
    })();
  });
}

function createBot() {
  /** First spawn after connect: server login + public hello (mineflayer may emit spawn more than once). */
  let hasAnnouncedPresence = false;
  let spawnHelloTimer = null;
  let friendGreetingTimer = null;
  let authFollowupTimer = null;
  let ambientTimer = null;
  let lastAuthCmdAt = 0;
  let warnedMissingAuthConfig = false;
  let loginAttempts = 0;
  let registerAttempts = 0;
  let authRequired = false;
  let authReady = false;
  const pendingPublicChat = [];

  const spawnMsg = (process.env.MC_SPAWN_CHAT || '').trim() || '0/';
  const loginDelayMs = parseInt(process.env.MC_LOGIN_CHAT_DELAY_MS || '600', 10);
  const spawnChatDelayMs = parseInt(process.env.MC_SPAWN_CHAT_DELAY_MS || '1600', 10);
  const loginCmdFromEnv = (process.env.MC_LOGIN_CMD || '').trim();
  const authPassword = (process.env.MC_AUTH_PASSWORD || process.env.MC_AUTHME_PASSWORD || process.env.MC_LOGIN_PASSWORD || '').trim();
  const autoAuthEnabled = parseBool(process.env.MC_AUTO_AUTH, true);
  const autoRegisterEnabled = parseBool(process.env.MC_AUTO_REGISTER, false);
  const maxLoginAttempts = Math.max(1, parseInt(process.env.MC_MAX_LOGIN_ATTEMPTS || '4', 10));
  const maxRegisterAttempts = Math.max(0, parseInt(process.env.MC_MAX_REGISTER_ATTEMPTS || '2', 10));

  const botFriends = (process.env.BOT_FRIENDS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== config.username.toLowerCase());

  function isFriend(username) {
    return username && botFriends.includes(String(username).toLowerCase());
  }

  const createOpts = {
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: config.auth,
  };
  const accountPassword = process.env.MC_PASSWORD || process.env.MC_PASS;
  if (accountPassword) createOpts.password = accountPassword;

  bot = mineflayer.createBot(createOpts);
  const connectionBot = bot;
  setBlackboard(state, 'authRequired', false);
  setBlackboard(state, 'authReady', false);
  setBlackboard(state, 'regionProtected', false);
  setBlackboard(state, 'blockedBreakCount', 0);

  bot.loadPlugin(pathfinder);

  function applyMovementRules() {
    if (bot !== connectionBot || !connectionBot.pathfinder) return;
    const move = new Movements(connectionBot);
    move.canDig = !Boolean(state.blackboard?.regionProtected);
    move.allow1by1towers = allow1by1Towers;
    connectionBot.pathfinder.setMovements(move);
  }

  function setProtectedMode(enabled, reason = '') {
    const nowEnabled = Boolean(enabled);
    const prevEnabled = Boolean(state.blackboard?.regionProtected);
    if (nowEnabled === prevEnabled) return;
    setBlackboard(state, 'regionProtected', nowEnabled);
    if (nowEnabled) {
      const extra = reason ? ` (${reason})` : '';
      console.warn(`[World] Protected area detected${extra}; disabling dig and exploring farther.`);
      try { connectionBot.pathfinder?.setGoal(null); } catch (e) {}
    } else {
      console.log('[World] Left protected area; digging re-enabled.');
    }
    applyMovementRules();
  }

  function clearConnectionTimers() {
    if (spawnHelloTimer) clearTimeout(spawnHelloTimer);
    if (friendGreetingTimer) clearTimeout(friendGreetingTimer);
    if (authFollowupTimer) clearTimeout(authFollowupTimer);
    if (ambientTimer) clearTimeout(ambientTimer);
    spawnHelloTimer = null;
    friendGreetingTimer = null;
    authFollowupTimer = null;
    ambientTimer = null;
  }

  function maskAuthCommand(command) {
    const raw = String(command || '').trim();
    if (!raw) return raw;
    const first = raw.split(/\s+/)[0].toLowerCase();
    if (first === '/login') return '/login ***';
    if (first === '/register') return '/register *** ***';
    return raw;
  }

  function sendChatLine(message, label, logOverride) {
    const text = String(message ?? '').trim();
    if (!text) return false;
    if (bot !== connectionBot) return false;
    const logText = logOverride == null ? text : logOverride;
    console.log(`[Bot] ${label}:`, logText);
    try {
      connectionBot.chat(text);
      return true;
    } catch (e) {
      console.error('[Bot] chat failed:', e.message);
      return false;
    }
  }

  function sendPublicChat(message) {
    const text = String(message ?? '').trim();
    if (!text) return false;
    if (authRequired && !authReady) {
      if (pendingPublicChat.length < 8) pendingPublicChat.push(text);
      console.log('[Bot] Chat queued (waiting auth):', text);
      return false;
    }
    return sendChatLine(text, 'Chat');
  }

  function flushPendingChat() {
    if (!authReady || pendingPublicChat.length === 0) return;
    while (pendingPublicChat.length > 0) {
      const queued = pendingPublicChat.shift();
      sendChatLine(queued, 'Chat');
    }
  }

  function sendHumanReply(message, minMs = 450, maxMs = 1400) {
    const delay = randomBetween(minMs, maxMs);
    setTimeout(() => { sendPublicChat(message); }, delay);
  }

  function buildLoginCommand() {
    if (loginCmdFromEnv) return loginCmdFromEnv;
    if (authPassword) return `/login ${authPassword}`;
    return '';
  }

  function buildRegisterCommand() {
    if (!authPassword) return '';
    return `/register ${authPassword} ${authPassword}`;
  }

  function warnMissingAuth(source) {
    if (warnedMissingAuthConfig) return;
    warnedMissingAuthConfig = true;
    authRequired = true;
    authReady = false;
    setBlackboard(state, 'authRequired', true);
    setBlackboard(state, 'authReady', false);
    console.warn('[Auth] Login required by server but no MC_LOGIN_CMD/MC_AUTH_PASSWORD configured. Source:', source);
  }

  function maybeSendLogin(source) {
    if (!autoAuthEnabled) return false;
    const command = buildLoginCommand();
    if (!command) {
      warnMissingAuth(source);
      return false;
    }
    if (loginAttempts >= maxLoginAttempts) return false;
    const now = Date.now();
    if (now - lastAuthCmdAt < authCmdCooldownMs) return false;
    lastAuthCmdAt = now;
    loginAttempts++;
    console.log(`[Auth] Sending login command (${source}, ${loginAttempts}/${maxLoginAttempts}).`);
    const sent = sendChatLine(command, 'Auth', maskAuthCommand(command));
    if (sent) {
      authRequired = true;
      authReady = false;
      setBlackboard(state, 'authRequired', true);
      setBlackboard(state, 'authReady', false);
    }
    return sent;
  }

  function maybeSendRegister(source) {
    if (!autoAuthEnabled || !autoRegisterEnabled) return false;
    const command = buildRegisterCommand();
    if (!command) {
      warnMissingAuth(source);
      return false;
    }
    if (registerAttempts >= maxRegisterAttempts) return false;
    const now = Date.now();
    if (now - lastAuthCmdAt < authCmdCooldownMs) return false;
    lastAuthCmdAt = now;
    registerAttempts++;
    console.log(`[Auth] Sending register command (${source}, ${registerAttempts}/${maxRegisterAttempts}).`);
    const sent = sendChatLine(command, 'Auth', maskAuthCommand(command));
    if (sent) {
      authRequired = true;
      authReady = false;
      setBlackboard(state, 'authRequired', true);
      setBlackboard(state, 'authReady', false);
    }
    return sent;
  }

  function scheduleAmbientAction() {
    if (ambientTimer) clearTimeout(ambientTimer);
    const waitMs = randomBetween(humanActionMinMs, humanActionMaxMs);
    ambientTimer = setTimeout(() => {
      if (bot !== connectionBot || !connectionBot.entity || connectionBot.isAlive === false) return;
      if (connectionBot.pathfinder?.goal) {
        scheduleAmbientAction();
        return;
      }
      const roll = Math.random();
      if (roll < 0.6) {
        const yaw = connectionBot.entity.yaw + (Math.random() - 0.5) * 1.2;
        const pitch = Math.max(-1.2, Math.min(1.2, connectionBot.entity.pitch + (Math.random() - 0.5) * 0.4));
        connectionBot.look(yaw, pitch, true).catch(() => {});
        console.log('[Human] Looking around.');
      } else if (roll < 0.8) {
        connectionBot.setControlState('jump', true);
        setTimeout(() => {
          if (bot === connectionBot) connectionBot.setControlState('jump', false);
        }, randomBetween(120, 260));
        console.log('[Human] Jump.');
      } else {
        connectionBot.setControlState('sneak', true);
        setTimeout(() => {
          if (bot === connectionBot) connectionBot.setControlState('sneak', false);
        }, randomBetween(250, 600));
        console.log('[Human] Sneak.');
      }
      scheduleAmbientAction();
    }, waitMs);
  }

  bot.on('login', () => {
    console.log(`[Bot] Logging in as ${config.username} → ${config.host}:${config.port} (${config.version})`);
  });

  function greetPlayer(username) {
    if (!username || username === connectionBot.username) return;
    sendHumanReply(`Hi, ${username}!`);
  }

  function onSpawn() {
    applyMovementRules();
    const p = connectionBot.entity.position;
    setBlackboard(state, 'spawnPos', { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
    console.log('[Bot] Spawned at', p);

    if (!hasAnnouncedPresence) {
      hasAnnouncedPresence = true;
      const sentLogin = maybeSendLogin('spawn');
      const sendSpawnHello = () => sendPublicChat(spawnMsg);
      if (sentLogin && loginDelayMs > 0) {
        spawnHelloTimer = setTimeout(sendSpawnHello, loginDelayMs);
      } else if (spawnChatDelayMs > 0) {
        spawnHelloTimer = setTimeout(sendSpawnHello, spawnChatDelayMs);
      } else {
        sendSpawnHello();
      }

      if (botFriends.length > 0) {
        friendGreetingTimer = setTimeout(() => {
          for (const [name, player] of Object.entries(connectionBot.players || {})) {
            if (player && player.entity && name !== connectionBot.username && isFriend(name)) greetPlayer(name);
          }
        }, 4000);
      }
    }

    scheduleAmbientAction();
    scheduleLoop();
  }

  bot.on('spawn', onSpawn);

  bot.on('messagestr', (line) => {
    const msg = String(line || '').trim();
    if (!msg) return;
    console.log('[Server]', msg);

    if (/move a little more before you can chat|we get lots of spam bots here|spawn protection/i.test(msg)) {
      setProtectedMode(true, 'spawn anti-spam/protection');
    }
    if (/can't break that block here|you can't break that block here|no puedes romper/i.test(msg)) {
      const blockedCount = (state.blackboard?.blockedBreakCount || 0) + 1;
      setBlackboard(state, 'blockedBreakCount', blockedCount);
      setProtectedMode(true, 'server denied block break');
    }

    const signal = detectAuthSignal(msg);
    if (!signal) return;

    if (signal === 'register_blocked') {
      authRequired = true;
      authReady = false;
      loginAttempts = maxLoginAttempts;
      registerAttempts = maxRegisterAttempts;
      setBlackboard(state, 'authRequired', true);
      setBlackboard(state, 'authReady', false);
      console.error('[Auth] Registration blocked for this connection/IP. Use an existing registered account.');
      return;
    }

    if (signal === 'needs_register') {
      authRequired = true;
      authReady = false;
      setBlackboard(state, 'authRequired', true);
      setBlackboard(state, 'authReady', false);
      const registered = maybeSendRegister('server-message');
      if (registered) {
        if (authFollowupTimer) clearTimeout(authFollowupTimer);
        authFollowupTimer = setTimeout(() => { maybeSendLogin('post-register'); }, 1200);
        return;
      }
      maybeSendLogin('server-message');
      return;
    }

    if (signal === 'needs_login') {
      authRequired = true;
      authReady = false;
      setBlackboard(state, 'authRequired', true);
      setBlackboard(state, 'authReady', false);
      maybeSendLogin('server-message');
      return;
    }

    if (signal === 'login_ok') {
      authRequired = false;
      authReady = true;
      setBlackboard(state, 'authRequired', false);
      setBlackboard(state, 'authReady', true);
      console.log('[Auth] Login acknowledged by server.');
      flushPendingChat();
      return;
    }

    if (signal === 'wrong_password') {
      authRequired = true;
      authReady = false;
      setBlackboard(state, 'authRequired', true);
      setBlackboard(state, 'authReady', false);
      console.error('[Auth] Server rejected credentials (wrong password).');
    }
  });

  bot.on('death', () => {
    console.log('[Bot] Died.');
    try { connectionBot.pathfinder?.setGoal(null); } catch (e) {}
  });

  bot.on('respawn', () => {
    console.log('[Bot] Respawned — restarting task loop.');
    setTimeout(() => {
      if (bot === connectionBot && connectionBot.entity) {
        const p = connectionBot.entity.position;
        setBlackboard(state, 'spawnPos', { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
        applyMovementRules();
        scheduleAmbientAction();
        scheduleLoop();
      }
    }, 800);
  });

  bot.on('move', () => {
    if (bot !== connectionBot || !connectionBot.entity) return;
    if (!state.blackboard?.regionProtected) return;
    const sp = state.blackboard?.spawnPos;
    if (!sp) return;
    const dx = connectionBot.entity.position.x - sp.x;
    const dz = connectionBot.entity.position.z - sp.z;
    const dist2 = dx * dx + dz * dz;
    if (dist2 >= protectedClearDist * protectedClearDist) {
      setBlackboard(state, 'blockedBreakCount', 0);
      setProtectedMode(false);
    }
  });

  bot.on('playerJoined', (player) => {
    if (player.username && isFriend(player.username)) {
      setTimeout(() => greetPlayer(player.username), 1500);
    }
  });

  bot.on('chat', (username, message) => {
    if (username === connectionBot.username) return;
    console.log('[Chat] <', username, '>', message);
    const raw = String(message || '').trim();
    const lower = raw.toLowerCase();
    if (isFriend(username) && (lower === 'hello' || lower === 'hi' || lower === 'hey')) {
      sendHumanReply(`Hello, ${username}!`);
      return;
    }
    if (lower === 'ping') {
      sendHumanReply('pong');
      return;
    }
    if (lower === '!time') {
      const t = connectionBot.time?.timeOfDay ?? 0;
      const phase = connectionBot.time?.isDay ? 'Day' : 'Night';
      const p = connectionBot.entity?.position;
      const posStr = p ? ` @ (${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)})` : '';
      sendHumanReply(`${phase} (${t} ticks)${posStr}`);
      return;
    }
    if (lower === '!players') {
      const names = Object.keys(connectionBot.players || {}).filter((n) => n !== connectionBot.username);
      sendHumanReply(names.length ? `Online: ${names.join(', ')}` : 'No other players online.');
      return;
    }
    if (lower === '!health' || lower === '!status') {
      sendHumanReply(`Health: ${connectionBot.health ?? '?'} | Food: ${connectionBot.food ?? '?'}`);
      return;
    }
    if (lower === '!logros' || lower === '!advancements' || lower === '!avances') {
      const done = getCompleted(state, connectionBot);
      const pending = getIncomplete(state, connectionBot);
      sendHumanReply(`Logros: ${done.length}/${done.length + pending.length} completados.`);
      if (pending.length > 0) {
        const next = getNextTaskForAdvancement(state, connectionBot);
        if (next) {
          sendHumanReply(`Siguiente: "${next.advancement.name}" (tarea: ${next.taskId}).`);
        }
      }
      return;
    }
  });

  bot.on('kicked', (reason) => {
    lastKickReason = formatKickReason(reason);
    console.log('[Bot] Kicked:', lastKickReason);
    if (/wrong password|incorrect password|invalid password|contrasena|contraseña/i.test(lastKickReason)) {
      console.error('[Auth] Wrong password. Configure MC_LOGIN_CMD or MC_AUTH_PASSWORD in autonomous/.env');
    }
  });
  bot.on('error', (err) => console.error('[Bot] Error:', err.message));
  bot.on('end', (reason) => {
    console.log('[Bot] Disconnected:', reason || 'unknown');
    clearConnectionTimers();
    try { connectionBot.setControlState('jump', false); } catch (e) {}
    try { connectionBot.setControlState('sneak', false); } catch (e) {}
    hasAnnouncedPresence = false;
    if (bot === connectionBot) bot = null;
    const slowReconnect = kickNeedsSlowReconnect(lastKickReason);
    const delayMs = slowReconnect ? 35000 : 3000;
    console.log('[Bot] Restarting in', delayMs / 1000, 's...');
    setTimeout(createBot, delayMs);
  });

  return connectionBot;
}

createBot();
