'use strict';

const { nextRoadmapTask } = require('./planner');
const { syncProgressFromInventory, updateSituation } = require('./situation');
const retry = require('./retryPolicy');
const { setBlackboard } = require('./state');

const STUCK_FAILURES_BEFORE_EXPLORE = parseInt(process.env.STUCK_FAILURES_BEFORE_EXPLORE || '2', 10);
const IGNORE_RETREAT_TASKS = /^(1|true|yes|on)$/i.test(process.env.IGNORE_RETREAT_TASKS || '');

/**
 * Critical survival: very low health + threats → retreat before anything else.
 */
function criticalInterrupt(state, bot) {
  if (IGNORE_RETREAT_TASKS) return null;
  if (!bot || bot.health == null) return null;
  const h = bot.health;
  const hostiles = state.blackboard?.nearHostiles ?? 0;
  if (h <= 8 && hostiles >= 1) {
    return { taskId: 'retreat', params: { urgency: 'high' }, reason: 'Critical health with hostiles; retreat.' };
  }
  if (h <= 12 && hostiles >= 4) {
    return { taskId: 'retreat', params: { urgency: 'medium' }, reason: 'Low health + many hostiles; retreat.' };
  }
  return null;
}

/**
 * If roadmap wants a gather task but we're stuck (failures), explore to load new terrain.
 */
function maybeExploreInstead(state, roadmap) {
  const id = roadmap.taskId;
  if (id === 'idle' || id === 'explore_nearby' || id === 'retreat') return null;
  if (retry.isInCooldown(state, id)) {
    return {
      taskId: 'explore_nearby',
      params: { forTask: id },
      reason: `Cooldown after failures on ${id}; explore to find resources.`,
    };
  }
  if (retry.isGatherTask(id) && retry.getFailureCount(state, id) >= STUCK_FAILURES_BEFORE_EXPLORE) {
    return {
      taskId: 'explore_nearby',
      params: { forTask: id },
      reason: `Stuck on ${id}; explore nearby chunks.`,
    };
  }
  return null;
}

/**
 * Full cognitive loop: sync world → critical interrupt → roadmap → explore substitution.
 */
function nextTask(state, bot) {
  if (!state) return { taskId: 'idle', params: {}, reason: 'No state.' };

  if (bot) {
    syncProgressFromInventory(state, bot);
    updateSituation(bot, state);
  }

  const crit = criticalInterrupt(state, bot);
  if (crit) return crit;

  let roadmap = nextRoadmapTask(state, bot);

  const explore = maybeExploreInstead(state, roadmap);
  if (explore) return explore;

  return roadmap;
}

/**
 * After successful explore, widen search radius and clear failures for the task we were stuck on.
 */
function onExploreSuccess(state, params) {
  const forTask = params?.forTask;
  if (forTask) retry.recordSuccess(state, forTask);
  const cur = state.blackboard?.miningMaxDistance ?? 32;
  const next = Math.min(192, cur + 12);
  setBlackboard(state, 'miningMaxDistance', next);
}

module.exports = { nextTask, criticalInterrupt, maybeExploreInstead, onExploreSuccess };
