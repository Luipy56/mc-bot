'use strict';

/**
 * Jarvys status lines in English:
 * - Primary: structured logs on stderr tagged [JarvysAgent] for the Cursor / AI agent (grep, scripts).
 * - Optional: same text in Minecraft chat for players (JARVYS_VOICE_GAME_CHAT).
 *
 * Throttled via JARVYS_VOICE_MIN_MS / JARVYS_VOICE_URGENT_MS.
 */

const retry = require('./retryPolicy');
const { setBlackboard } = require('./state');

const HUNGRY = [
  "I'm getting pretty hungry—need to find food before this gets worse.",
  "Hunger is creeping up; I should secure something to eat soon.",
  "My food bar is low. I haven't found a reliable food source yet.",
  "Running low on energy—I could really use some food around here.",
];

const STARVING = [
  "I'm starving—this is getting dangerous.",
  "Critical hunger—I might die if I don't eat something very soon.",
  "I'm about to starve. I can't keep going like this without food.",
];

const STUCK_MOVEMENT = [
  "I feel stuck—I haven't been able to move properly for a while.",
  "I've barely moved from this spot; pathfinding or terrain may be blocking me.",
  "Something is wrong—I keep failing to path somewhere useful.",
  "I'm trapped in place more or less; I need a new route or help.",
];

const STUCK_TASK_LONG = [
  "I've spent too long on {{task}} with no real progress.",
  "{{task}} is taking forever—I can't seem to finish it.",
  "Still stuck on {{task}}. Either I'm missing resources or the world isn't cooperating.",
];

const STRUGGLE_TASK = [
  "{{task}} keeps failing. I'm not sure what I'm doing wrong.",
  "Having a hard time with {{task}}—might need to explore or change approach.",
];

const COMBAT_FAIL = [
  "I couldn't handle that hostile mob. I'm not sure how to fight it safely yet.",
  "Combat didn't go well—I failed to attack or kill what I was after.",
  "That enemy got the better of me. I need better gear or a smarter angle.",
];

const PATH_FAIL = [
  "Pathfinding timed out or the goal was cancelled—I couldn't reach where I needed.",
  "I couldn't path to the target in time. Terrain or protection might be in the way.",
];

const PROTECTED = [
  "The server won't let me break blocks here—I'll have to walk farther out.",
  "Spawn or claim protection is blocking my actions; I need to leave this zone.",
];

const NO_RESOURCES = [
  "I'm not finding what I need nearby—might need to explore farther.",
  "Resources seem absent in this chunk; I've been searching without luck.",
];

const LOST = [
  "I'm a bit lost on what to do next—things aren't lining up.",
  "Not sure what the right move is right now; my plan keeps breaking down.",
  "I'm confused about the next step—too many failures in a row.",
];

const EXPLORE_FRUSTRATION = [
  "Exploring isn't helping fast enough—I still can't find what I need.",
  "I've roamed a lot and I'm still empty-handed.",
];

const END_NETHER = [
  "The Nether or End phase is rough—everything is more dangerous here.",
  "Hard to progress in this dimension; one mistake and I'm in trouble.",
];

const DEATH = [
  "That didn't go well—I died. I'll try again from spawn.",
  "I died. Need to be more careful next time.",
  "Death reset me. Hunger, mobs, or fall—something got me.",
];

const CRAFT_FAIL = [
  "Crafting failed—I might be missing materials or a crafting surface.",
  "I couldn't complete that recipe. Inventory or table access is wrong somehow.",
];

const PLACE_FAIL = [
  "I can't place that block here—surface, protection, or inventory issue.",
  "Placement failed. Maybe I'm in a protected zone or the spot is invalid.",
];

const SMELT_FAIL = [
  "Smelting isn't working—furnace fuel, input, or reach might be the problem.",
];

const SLEEP_FAIL = [
  "I couldn't sleep—monsters nearby, wrong time, or no valid bed.",
];

const INVENTORY = [
  "My inventory doesn't match what the plan expects—something was used or lost.",
];

const DRAGON_CRYSTALS = [
  "End crystals or the dragon are giving me trouble—this fight needs more prep.",
];

const STRONGHOLD = [
  "The stronghold search is dragging—eyes of ender or terrain are not helping.",
];

function voiceEnabled() {
  return !/^(0|false|no|off)$/i.test(process.env.JARVYS_VOICE ?? '1');
}

function gameChatEnabled() {
  return !/^(0|false|no|off)$/i.test(process.env.JARVYS_VOICE_GAME_CHAT ?? '1');
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function humanizeTask(taskId) {
  if (!taskId) return 'this step';
  const map = {
    collect_wood: 'getting wood',
    collect_more_wood: 'gathering more wood',
    collect_cobblestone: 'mining cobblestone',
    collect_coal: 'finding coal',
    collect_iron_ore: 'mining iron',
    collect_diamond_ore: 'finding diamonds',
    collect_obsidian: 'mining obsidian',
    craft_planks: 'crafting planks',
    craft_crafting_table: 'making a crafting table',
    place_crafting_table: 'placing the crafting table',
    craft_wood_pick: 'making a wooden pickaxe',
    collect_blaze_rods: 'getting blaze rods',
    collect_ender_pearls: 'farming ender pearls',
    find_stronghold: 'finding the stronghold',
    fill_end_portal: 'activating the End portal',
    kill_ender_dragon: 'fighting the Ender Dragon',
    hunt_food: 'hunting for food',
    kill_enemy: 'fighting a hostile mob',
    build_nether_portal: 'building the Nether portal',
    enter_nether: 'entering the Nether',
    explore_nearby: 'exploring',
    goto_test: 'reaching my first waypoint',
    build_wooden_house: 'building the shelter',
    smelt_iron_ingots: 'smelting iron',
    craft_stone_sword: 'making a stone sword',
    craft_stone_axe: 'making a stone axe',
    craft_wood_axe: 'making a wooden axe',
    craft_torch: 'making torches',
    craft_iron_sword: 'making an iron sword',
    craft_shears: 'making shears',
    shear_sheep: 'shearing a sheep',
    collect_grass_seeds: 'getting wheat seeds',
    craft_stone_hoe: 'making a stone hoe',
    till_plant_wheat: 'planting wheat',
    harvest_mature_wheat: 'harvesting wheat',
    craft_bread: 'baking bread',
    milk_cow: 'milking a cow',
    collect_sand: 'gathering sand',
    smelt_glass: 'smelting glass',
    collect_sugar_cane: 'gathering sugar cane',
    craft_paper: 'making paper',
    craft_fishing_rod: 'making a fishing rod',
    wave_at_nearby_player: 'waving at someone',
    glance_behind: 'looking behind me',
    craft_iron_bucket: 'making an iron bucket',
    fill_water_bucket: 'filling a bucket with water',
    place_water_source: 'placing a water source',
    craft_iron_armor_set: 'making iron armor',
    equip_iron_kit: 'equipping iron gear',
    lighten_inventory: 'clearing inventory junk',
  };
  return map[taskId] || String(taskId).replace(/_/g, ' ');
}

function fill(template, taskId) {
  return template.replace(/\{\{task\}\}/g, humanizeTask(taskId));
}

function getVoiceBucket(state) {
  const b = state.blackboard?.jarvysVoice;
  if (b && typeof b === 'object') return b;
  return {};
}

function putVoiceBucket(state, patch) {
  const cur = getVoiceBucket(state);
  setBlackboard(state, 'jarvysVoice', { ...cur, ...patch });
}

function canSpeakNow(state, urgent) {
  const minMs = parseInt(process.env.JARVYS_VOICE_MIN_MS || '45000', 10);
  const urgentMs = parseInt(process.env.JARVYS_VOICE_URGENT_MS || '22000', 10);
  const bb = getVoiceBucket(state);
  const last = bb.lastSpokeAt || 0;
  const gap = urgent ? urgentMs : minMs;
  return Date.now() - last >= gap;
}

/**
 * Log for the AI agent (always when voice fires). Single JSON line after throttle — no Minecraft needed.
 */
function logForAiAgent(line, urgent, bot, context = {}) {
  const pos = bot?.entity?.position;
  const record = {
    forAgent: true,
    msg: line,
    urgent: Boolean(urgent),
    event: context.event || 'afterTask',
    taskId: context.taskId ?? undefined,
    taskSuccess: context.taskSuccess,
    failReason: context.failReason ? String(context.failReason).slice(0, 280) : undefined,
    food: bot?.food,
    health: bot?.health,
    pos: pos
      ? { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10, z: Math.round(pos.z * 10) / 10 }
      : undefined,
    gameChat: gameChatEnabled(),
  };
  Object.keys(record).forEach((k) => {
    if (record[k] === undefined) delete record[k];
  });
  console.warn('[JarvysAgent]', JSON.stringify(record));
}

function tryEmitVoice(bot, state, line, urgent, context = {}) {
  if (!line || !voiceEnabled()) return false;
  if (!bot || !state) return false;
  if (state.blackboard?.authRequired && !state.blackboard?.authReady) return false;
  if (!canSpeakNow(state, urgent)) return false;

  logForAiAgent(line, urgent, bot, context);

  if (gameChatEnabled()) {
    try {
      bot.chat(line);
    } catch (e) {
      console.warn('[JarvysAgent] game chat failed:', e.message || e);
    }
  }

  putVoiceBucket(state, { lastSpokeAt: Date.now() });
  return true;
}

/**
 * Call after each agent task. Updates movement stagnation and may speak.
 */
function afterTask(bot, state, { task, result } = {}) {
  if (!voiceEnabled() || !bot?.entity || !state) return;

  if (state.blackboard?.authRequired && !state.blackboard?.authReady) return;

  const p = bot.entity.position;
  const now = Date.now();
  const bb = getVoiceBucket(state);
  let anchorX = bb.anchorX != null ? bb.anchorX : p.x;
  let anchorZ = bb.anchorZ != null ? bb.anchorZ : p.z;
  let stagnationSince = bb.stagnationSince != null ? bb.stagnationSince : now;
  const moved = Math.hypot(p.x - anchorX, p.z - anchorZ);
  if (moved > 1.25) {
    anchorX = p.x;
    anchorZ = p.z;
    stagnationSince = now;
  }
  putVoiceBucket(state, { anchorX, anchorZ, stagnationSince });

  const stagnationMs = now - stagnationSince;
  const stagnationThreshold = parseInt(process.env.JARVYS_VOICE_STAGNATION_MS || '95000', 10);
  const taskId = task?.taskId;
  const ok = result?.success !== false;
  const reason = String(result?.reason || '').toLowerCase();
  const fails = taskId ? retry.getFailureCount(state, taskId) : 0;

  let line = null;
  let urgent = false;

  if (bot.food != null && bot.food <= 2) {
    line = pick(STARVING);
    urgent = true;
  } else if (bot.food != null && bot.food <= 8 && !ok && /food|hunt|eat|meat|passive/i.test(reason + ' ' + (taskId || ''))) {
    line = pick(HUNGRY);
    urgent = bot.food <= 5;
  }

  if (!line && stagnationMs >= stagnationThreshold && taskId && taskId !== 'idle' && taskId !== 'explore_nearby') {
    line = pick(STUCK_MOVEMENT);
    urgent = stagnationMs >= stagnationThreshold * 1.4;
  }

  if (!line && !ok) {
    if (/protected|can'?t break|denied|spawn/i.test(reason)) {
      line = pick(PROTECTED);
    } else if (/path|timeout|goal|pathfind/i.test(reason)) {
      line = pick(PATH_FAIL);
    } else if (taskId === 'kill_enemy' || taskId === 'hunt_food') {
      line = pick(COMBAT_FAIL);
      urgent = true;
    } else if (fails >= 6) {
      line = fill(pick(STUCK_TASK_LONG), taskId);
    } else if (fails >= 3) {
      line = fill(pick(STRUGGLE_TASK), taskId);
    } else if (/no .+ found|not nearby|missing/i.test(reason)) {
      line = pick(NO_RESOURCES);
    } else if (/craft|recipe/i.test(reason)) {
      line = pick(CRAFT_FAIL);
    } else if (/place|placement|can'?t place/i.test(reason)) {
      line = pick(PLACE_FAIL);
    } else if (/furnace|smelt|fuel/i.test(reason)) {
      line = pick(SMELT_FAIL);
    } else if (/sleep|bed|phantom/i.test(reason)) {
      line = pick(SLEEP_FAIL);
    } else if (/inventory|no .+ in inventory/i.test(reason)) {
      line = pick(INVENTORY);
    }
  }

  if (!line && !ok && (taskId === 'destroy_end_crystals' || taskId === 'kill_ender_dragon')) {
    line = pick(DRAGON_CRYSTALS);
  }

  if (!line && !ok && taskId === 'find_stronghold') {
    line = pick(STRONGHOLD);
  }

  if (!line && !ok && taskId === 'explore_nearby' && fails >= 4) {
    line = pick(EXPLORE_FRUSTRATION);
  }

  if (!line && !ok && taskId === 'enter_nether') {
    line = pick(END_NETHER);
  }

  if (!line && !ok && fails >= 8) {
    line = pick(LOST);
    urgent = true;
  }

  if (line) {
    tryEmitVoice(bot, state, line, urgent, {
      taskId,
      taskSuccess: ok,
      failReason: result?.reason,
      event: 'afterTask',
    });
  }
}

function onDeath(bot, state) {
  if (!voiceEnabled() || !bot) return;
  tryEmitVoice(bot, state, pick(DEATH), true, {
    event: 'death',
    taskSuccess: false,
    failReason: 'player death',
  });
}

module.exports = {
  afterTask,
  onDeath,
  voiceEnabled,
  gameChatEnabled,
  logForAiAgent,
  humanizeTask,
  pick,
};
