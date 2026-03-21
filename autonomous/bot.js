#!/usr/bin/env node
'use strict';

/**
 * Autonomous Mineflayer bot — goal: complete the game (Ender Dragon).
 * Config from .env: NAME/SERVER_IP/PORT/VERSION or MC_*.
 * Loads pathfinder and runs task loop after spawn.
 */

const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;

const { getConfig } = require('./lib/config');
const { createState, markCompleted, isCompleted, setBlackboard } = require('./lib/state');
const { nextTask } = require('./lib/brain');
const { createExecutor } = require('./lib/executor');
const { loadState, saveState } = require('./lib/persistence');
const { formatKickReason, kickNeedsSlowReconnect } = require('./lib/kickReason');
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

const combatSkill = require('./skills/combat');
const diamondCaveSkill = require('./skills/diamondCave');
const config = getConfig();

const skills = {
  goto_test: movementSkill,
  collect_wood: miningSkill,
  collect_cobblestone: miningSkill,
  collect_more_wood: miningSkill,
  collect_coal: miningSkill,
  collect_obsidian: miningSkill,
  craft_planks: craftingSkill,
  craft_sticks: craftingSkill,
  craft_crafting_table: craftingSkill,
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
          const task = nextTask(state, bot);
          console.log('[Agent] Task:', task.taskId, '—', task.reason);
          const result = await runTask(bot, state, task);
          console.log('[Agent] Result:', result.success ? 'ok' : 'fail', result.reason);
          saveState(state);
          if (task.taskId === 'idle') break;
          if (!bot || !bot.entity || bot.isAlive === false) break;
          if (!result.success && taskFailRetryMs > 0) {
            await new Promise((r) => setTimeout(r, taskFailRetryMs));
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
  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: config.auth,
  });

  bot.loadPlugin(pathfinder);

  bot.on('login', () => {
    console.log(`[Bot] Logging in as ${config.username} → ${config.host}:${config.port} (${config.version})`);
  });

  function onSpawn() {
    const defaultMove = new Movements(bot);
    defaultMove.canDig = true;
    bot.pathfinder.setMovements(defaultMove);
    const p = bot.entity.position;
    setBlackboard(state, 'spawnPos', { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
    console.log('[Bot] Spawned at', p);
    bot.chat('Autonomous bot online.');
    scheduleLoop();
    if (botFriends.length > 0) {
      setTimeout(() => {
        for (const [name, player] of Object.entries(bot.players || {})) {
          if (player && player.entity && name !== bot.username && isFriend(name)) greetPlayer(name);
        }
      }, 4000);
    }
  }

  bot.on('spawn', onSpawn);

  bot.on('death', () => {
    console.log('[Bot] Died.');
    try { bot.pathfinder?.setGoal(null); } catch (e) {}
  });

  bot.on('respawn', () => {
    console.log('[Bot] Respawned — restarting task loop.');
    setTimeout(() => {
      if (bot && bot.entity) {
        const p = bot.entity.position;
        setBlackboard(state, 'spawnPos', { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
        scheduleLoop();
      }
    }, 800);
  });

  const botFriends = (process.env.BOT_FRIENDS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== config.username.toLowerCase());

  function isFriend(username) {
    return username && botFriends.includes(String(username).toLowerCase());
  }

  function greetPlayer(username) {
    if (!username || username === bot.username) return;
    bot.chat(`Hi, ${username}!`);
  }

  bot.on('playerJoined', (player) => {
    if (player.username && isFriend(player.username)) {
      setTimeout(() => greetPlayer(player.username), 1500);
    }
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log('[Chat] <', username, '>', message);
    const raw = String(message || '').trim();
    const lower = raw.toLowerCase();
    if (isFriend(username) && (lower === 'hello' || lower === 'hi' || lower === 'hey')) {
      bot.chat(`Hello, ${username}!`);
      return;
    }
    if (lower === 'ping') { bot.chat('pong'); return; }
    if (lower === '!time') {
      const t = bot.time?.timeOfDay ?? 0;
      const phase = bot.time?.isDay ? 'Day' : 'Night';
      const p = bot.entity?.position;
      const posStr = p ? ` @ (${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)})` : '';
      bot.chat(`${phase} (${t})${posStr}`);
      return;
    }
    if (lower === '!health' || lower === '!status') {
      bot.chat(`Health: ${bot.health ?? '?'} | Food: ${bot.food ?? '?'}`);
      return;
    }
    if (lower === '!logros' || lower === '!advancements' || lower === '!avances') {
      const done = getCompleted(state, bot);
      const pending = getIncomplete(state, bot);
      bot.chat(`Logros: ${done.length}/${done.length + pending.length} completados.`);
      if (pending.length > 0) {
        const next = getNextTaskForAdvancement(state, bot);
        if (next) {
          bot.chat(`Siguiente: "${next.advancement.name}" (tarea: ${next.taskId}).`);
        }
      }
      return;
    }
  });

  bot.on('kicked', (reason) => {
    lastKickReason = formatKickReason(reason);
    console.log('[Bot] Kicked:', lastKickReason);
  });
  bot.on('error', (err) => console.error('[Bot] Error:', err.message));
  bot.on('end', (reason) => {
    console.log('[Bot] Disconnected:', reason || 'unknown');
    bot = null;
    const slowReconnect = kickNeedsSlowReconnect(lastKickReason);
    const delayMs = slowReconnect ? 35000 : 3000;
    console.log('[Bot] Restarting in', delayMs / 1000, 's...');
    setTimeout(createBot, delayMs);
  });

  return bot;
}

createBot();
