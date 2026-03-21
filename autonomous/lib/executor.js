'use strict';

const { markCompleted } = require('./state');
const { capture } = require('./perception');
const retry = require('./retryPolicy');
const { onExploreSuccess } = require('./brain');

const DEFAULT_TASK_TIMEOUT_MS = 120000;

/** Clear pathfinder goal so the bot does not stay stuck (pathfinder can hang on unreachable blocks). */
function clearPathfinderGoal(bot) {
  try {
    if (bot && bot.pathfinder) bot.pathfinder.setGoal(null);
  } catch (e) { /* ignore */ }
}

function withTimeout(promise, ms, taskId) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Task ${taskId} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

/**
 * Run task by taskId; update state; return { success, nextTask, reason }.
 * Options: { taskTimeoutMs }.
 */
function createExecutor(skills, options = {}) {
  const timeoutMs = options.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
  const noCompleteTasks = new Set(['eat_if_needed', 'sleep_in_bed', 'explore_nearby', 'retreat']);

  return async function runTask(bot, state, task) {
    const { taskId, params, reason } = task;
    state.lastPerception = capture(bot);

    if (taskId === 'idle') {
      return { success: true, nextTask: null, reason };
    }

    const skill = skills[taskId];
    if (!skill) {
      if (taskId === 'init_structure') {
        markCompleted(state, 'init_structure');
        return { success: true, nextTask: taskId, reason: 'Init structure already done.' };
      }
      if (taskId === 'connect') {
        markCompleted(state, 'connect');
        return { success: true, nextTask: taskId, reason: 'Bot is connected (spawned).' };
      }
      return { success: false, nextTask: null, reason: `Unknown task: ${taskId}` };
    }

    try {
      const runPromise = skill.run(bot, state, { ...params, _taskId: taskId });
      const result = await withTimeout(runPromise, timeoutMs, taskId);
      if (result.success) {
        if (!noCompleteTasks.has(taskId)) markCompleted(state, taskId);
        if (taskId === 'explore_nearby') onExploreSuccess(state, params);
        retry.recordSuccess(state, taskId);
      } else {
        retry.recordFailure(state, taskId);
        clearPathfinderGoal(bot);
      }
      return { success: result.success, nextTask: taskId, reason: result.reason || reason };
    } catch (err) {
      retry.recordFailure(state, taskId);
      clearPathfinderGoal(bot);
      return { success: false, nextTask: taskId, reason: err.message || String(err) };
    }
  };
}

module.exports = { createExecutor };
