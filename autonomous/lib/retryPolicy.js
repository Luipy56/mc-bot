'use strict';

const DEFAULT_MAX_FAILURES = parseInt(process.env.TASK_MAX_FAILURES || '4', 10);
const COOLDOWN_MS = parseInt(process.env.TASK_COOLDOWN_MS || '45000', 10);

function _failures(state) {
  if (!state.blackboard.taskFailures) state.blackboard.taskFailures = {};
  return state.blackboard.taskFailures;
}

function _cooldowns(state) {
  if (!state.blackboard.taskCooldownUntil) state.blackboard.taskCooldownUntil = {};
  return state.blackboard.taskCooldownUntil;
}

/**
 * Record a failed run of taskId (increments counter, sets cooldown).
 */
function recordFailure(state, taskId) {
  if (!state || !taskId || taskId === 'idle' || taskId === 'explore_nearby' || taskId === 'retreat') return;
  const f = _failures(state);
  f[taskId] = (f[taskId] || 0) + 1;
  const maxF = DEFAULT_MAX_FAILURES;
  if (f[taskId] >= maxF) {
    _cooldowns(state)[taskId] = Date.now() + COOLDOWN_MS;
  }
}

/**
 * Clear failure streak on success.
 */
function recordSuccess(state, taskId) {
  if (!state || !taskId) return;
  const f = _failures(state);
  if (f[taskId]) delete f[taskId];
  delete _cooldowns(state)[taskId];
}

/**
 * True if task is in cooldown (too many recent failures).
 */
function isInCooldown(state, taskId) {
  if (!state || !taskId) return false;
  const until = _cooldowns(state)[taskId];
  if (!until) return false;
  if (Date.now() >= until) {
    delete _cooldowns(state)[taskId];
    _failures(state)[taskId] = 0;
    return false;
  }
  return true;
}

function getFailureCount(state, taskId) {
  return _failures(state)[taskId] || 0;
}

/**
 * Mining/gather tasks that benefit from exploration when stuck.
 */
function isGatherTask(taskId) {
  return /^(collect_|hunt_food|goto_test)/.test(taskId || '');
}

module.exports = {
  recordFailure,
  recordSuccess,
  isInCooldown,
  getFailureCount,
  isGatherTask,
  DEFAULT_MAX_FAILURES,
};
