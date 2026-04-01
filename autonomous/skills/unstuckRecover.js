'use strict';

const { runUnstuckRoutine } = require('../lib/unstuck');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Macro recovery when pathfinder / movement fails repeatedly (see lib/unstuck.js + brain).
 * params.deep: run two passes (chunk mission / heavy path failures).
 */
async function run(bot, state, params = {}) {
  const first = await runUnstuckRoutine(bot, state);
  if (params.deep) {
    await sleep(380);
    const second = await runUnstuckRoutine(bot, state);
    return {
      success: first.success && second.success,
      reason: `${first.reason} | ${second.reason}`,
    };
  }
  return first;
}

module.exports = { run };
