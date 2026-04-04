'use strict';

/**
 * Optional low-priority human-play flourishes between roadmap tasks (Jarvys).
 * Off by default; enable with JARVYS_HUMAN_PLAY_MICRO=1.
 */

const { setBlackboard } = require('./state');

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

const SKIP_AFTER_TASKS = new Set([
  'retreat',
  'kill_enemy',
  'unstuck_recover',
  'eat_if_needed',
  'idle',
  'connect',
  'init_structure',
]);

/**
 * @returns {{ taskId: string, params: object, reason: string } | null}
 */
function maybePickHumanMicroTask(state, bot, previousTaskId, previousSuccess) {
  if (!parseBool(process.env.JARVYS_HUMAN_PLAY_MICRO, false) || !state || !bot?.entity) return null;
  if (!previousSuccess) return null;
  if (!previousTaskId || SKIP_AFTER_TASKS.has(previousTaskId)) return null;
  if (String(previousTaskId).startsWith('human_human_')) return null;

  const chance = Math.min(1, Math.max(0, parseFloat(process.env.JARVYS_HUMAN_PLAY_MICRO_CHANCE || '0.12')));
  if (Math.random() > chance) return null;

  const hostiles = state.blackboard?.nearHostiles ?? 0;
  if (hostiles >= 1) return null;
  if (bot.health != null && bot.health <= 10) return null;

  const cooldownMs = Math.max(5000, parseInt(process.env.JARVYS_HUMAN_PLAY_MICRO_COOLDOWN_MS || '42000', 10));
  const now = Date.now();
  const last = state.blackboard?.lastJarvysHumanPlayAt || 0;
  if (now - last < cooldownMs) return null;

  const r = Math.random();
  let taskId;
  let reason;
  if (r < 0.55) {
    taskId = 'human_human_idle_camera_micro_yaw_noise';
    reason = 'Human-play micro: idle camera yaw.';
  } else if (r < 0.9) {
    taskId = 'human_human_180_glance_hostile_rear';
    reason = 'Human-play micro: glance behind.';
  } else {
    taskId = 'human_human_near_player_arm_swing_greeting';
    reason = 'Human-play micro: wave if another player is near.';
  }

  setBlackboard(state, 'lastJarvysHumanPlayAt', now);
  return { taskId, params: {}, reason };
}

module.exports = {
  maybePickHumanMicroTask,
  SKIP_AFTER_TASKS,
};
