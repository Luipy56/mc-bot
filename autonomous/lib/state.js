'use strict';

/**
 * GameState: phase, flags. Progress: completed task ids. Blackboard: counts, positions.
 */
function createState() {
  return {
    gameState: {
      phase: 'early',
      hasBed: false,
      hasIronPick: false,
      hasCraftingTable: false,
      hasChest: false,
      basePosition: null,
    },
    progress: [],
    blackboard: {},
    lastPerception: null,
  };
}

function markCompleted(state, taskId) {
  if (!state.progress.includes(taskId)) state.progress.push(taskId);
}

function isCompleted(state, taskId) {
  return state.progress.includes(taskId);
}

function setBlackboard(state, key, value) {
  state.blackboard[key] = value;
}

function getBlackboard(state, key) {
  return state.blackboard[key];
}

module.exports = { createState, markCompleted, isCompleted, setBlackboard, getBlackboard };
