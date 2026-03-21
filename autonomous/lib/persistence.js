'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULT_STATE_FILE = process.env.STATE_FILE
  ? path.resolve(process.env.STATE_FILE)
  : path.join(__dirname, '..', '.state.json');

/**
 * Save progress and gameState to file (blackboard optional). lastPerception not saved.
 */
function saveState(state, filePath = DEFAULT_STATE_FILE) {
  if (!state) return;
  const payload = {
    progress: state.progress || [],
    gameState: state.gameState || {},
    blackboard: state.blackboard || {},
  };
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 0), 'utf8');
  } catch (e) {
    console.error('[Persistence] Save failed:', e.message);
  }
}

/**
 * Load state from file and merge into state (progress, gameState, blackboard).
 */
function loadState(state, filePath = DEFAULT_STATE_FILE) {
  if (!state) return;
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.progress)) state.progress = data.progress;
    if (data.gameState && typeof data.gameState === 'object') Object.assign(state.gameState, data.gameState);
    if (data.blackboard && typeof data.blackboard === 'object') Object.assign(state.blackboard, data.blackboard);
  } catch (e) {
    console.error('[Persistence] Load failed:', e.message);
  }
}

module.exports = { saveState, loadState };
