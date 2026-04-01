'use strict';

/**
 * Small delays, head movement, and arm swings so task execution feels less robotic.
 * Toggle with HUMAN_LIKE_PLAYER (default on).
 */

function isEnabled() {
  return !/^(0|false|no|off)$/i.test(process.env.HUMAN_LIKE_PLAYER ?? '1');
}

function randomBetween(min, max) {
  const lo = Number.isFinite(min) ? Math.floor(min) : 0;
  const hi = Number.isFinite(max) ? Math.floor(max) : lo;
  if (hi <= lo) return Math.max(0, lo);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Skip heavy “thinking” for instant meta tasks. */
const SKIP_PRE_TASK = new Set(['idle', 'connect', 'init_structure', 'unstuck_recover']);

/**
 * Brief look + optional arm swing (does not block pathfinding goals).
 */
async function microGesture(bot) {
  if (!bot?.entity) return;
  if (Math.random() < 0.62 && typeof bot.look === 'function') {
    const e = bot.entity;
    const yaw = e.yaw + (Math.random() - 0.5) * 1.0;
    const pitch = Math.max(-1.1, Math.min(1.1, e.pitch + (Math.random() - 0.5) * 0.45));
    try {
      await bot.look(yaw, pitch, true);
    } catch (err) { /* ignore */ }
  }
  if (Math.random() < 0.3 && typeof bot.swingArm === 'function') {
    try {
      bot.swingArm('right', true);
    } catch (err) { /* ignore */ }
  }
}

async function beforeTask(bot, taskId) {
  if (!isEnabled() || !bot?.entity) return;
  if (SKIP_PRE_TASK.has(taskId)) return;
  const min = parseInt(process.env.HUMAN_PRE_TASK_MIN_MS || '70', 10);
  const max = parseInt(process.env.HUMAN_PRE_TASK_MAX_MS || '340', 10);
  await sleep(randomBetween(min, max));
  if (Math.random() < 0.58) await microGesture(bot);
}

async function afterTask(bot, taskId, success) {
  if (!isEnabled() || !bot?.entity) return;
  if (taskId === 'idle') return;
  const min = parseInt(process.env.HUMAN_POST_TASK_MIN_MS || '25', 10);
  const max = parseInt(process.env.HUMAN_POST_TASK_MAX_MS || '220', 10);
  await sleep(randomBetween(min, max));
  const p = success ? 0.14 : 0.26;
  if (Math.random() < p) await microGesture(bot);
}

async function maybeMiningBeat(bot) {
  if (!isEnabled() || !bot?.entity) return;
  const maxJ = parseInt(process.env.HUMAN_MINING_JITTER_MS || '95', 10);
  if (maxJ <= 0) return;
  await sleep(randomBetween(15, maxJ));
  if (Math.random() < 0.18) await microGesture(bot);
}

function huntingAttackDelayMs(baseMs) {
  if (!isEnabled()) return baseMs;
  const jitter = randomBetween(-130, 240);
  return Math.max(380, baseMs + jitter);
}

/** Before eating: tiny hesitation like selecting food bar. */
async function beforeEat(bot) {
  if (!isEnabled() || !bot?.entity) return;
  await sleep(randomBetween(120, 420));
  if (Math.random() < 0.35) await microGesture(bot);
}

module.exports = {
  isEnabled,
  randomBetween,
  sleep,
  microGesture,
  beforeTask,
  afterTask,
  maybeMiningBeat,
  huntingAttackDelayMs,
  beforeEat,
};
