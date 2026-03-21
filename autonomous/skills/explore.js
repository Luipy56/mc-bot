'use strict';

const { GoalNear } = require('mineflayer-pathfinder').goals;
const EXPLORE_GOTO_TIMEOUT_MS = parseInt(process.env.EXPLORE_GOTO_TIMEOUT_MS || '18000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function manualRoam(bot, ms = 5500) {
  const jumpPulse = setInterval(() => {
    try {
      bot.setControlState('jump', true);
      setTimeout(() => { try { bot.setControlState('jump', false); } catch (e) {} }, 180);
    } catch (e) {}
  }, 900);
  try {
    // Keep a straight-ish line in long roams to cover distance quickly.
    if (ms >= 30000) {
      const yaw = bot.entity?.yaw ?? 0;
      try { await bot.look(yaw, 0, true); } catch (e) {}
    }
    bot.setControlState('forward', true);
    if (Math.random() < 0.35) bot.setControlState('sprint', true);
    if (Math.random() < 0.25) bot.setControlState('left', true);
    if (Math.random() < 0.25) bot.setControlState('right', true);
    await sleep(ms);
  } finally {
    clearInterval(jumpPulse);
    try { bot.setControlState('forward', false); } catch (e) {}
    try { bot.setControlState('sprint', false); } catch (e) {}
    try { bot.setControlState('left', false); } catch (e) {}
    try { bot.setControlState('right', false); } catch (e) {}
    try { bot.setControlState('jump', false); } catch (e) {}
  }
}

function gotoWithTimeout(bot, goal, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try { bot.pathfinder?.setGoal(null); } catch (e) {}
      reject(new Error(`Explore path timeout (${ms}ms)`));
    }, ms);
    bot.pathfinder.goto(goal).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

/**
 * Walk to a semi-random point to load chunks / find new resources.
 * params: { forTask?: string } (for logging / brain callback).
 */
async function run(bot, state, params = {}) {
  if (!bot.pathfinder || !bot.entity) {
    return { success: false, reason: 'No pathfinder or entity.' };
  }

  const current = {
    x: Math.floor(bot.entity.position.x),
    y: Math.floor(bot.entity.position.y),
    z: Math.floor(bot.entity.position.z),
  };
  const protectedArea = Boolean(state.blackboard?.regionProtected);
  const taskHint = String(params.forTask || '').trim();
  const longRangeExplore = taskHint === 'collect_wood_for_house' || taskHint === 'build_wooden_house';
  const base = (protectedArea || longRangeExplore) ? current : (state.blackboard?.spawnPos || current);

  const minRadius = longRangeExplore ? 120 : (protectedArea ? 72 : 24);
  const maxRadius = longRangeExplore ? 320 : (protectedArea ? 140 : 48);
  const radius = minRadius + Math.floor(Math.random() * (maxRadius - minRadius + 1));
  const angle = Math.random() * Math.PI * 2;
  const dx = Math.round(Math.cos(angle) * radius);
  const dz = Math.round(Math.sin(angle) * radius);
  let tx = base.x + dx;
  let ty = base.y;
  let tz = base.z + dz;
  tx = Math.round(tx);
  tz = Math.round(tz);

  const goal = new GoalNear(tx, ty, tz, 3);
  try {
    await gotoWithTimeout(bot, goal, EXPLORE_GOTO_TIMEOUT_MS);
    return { success: true, reason: `Explored toward (${tx}, ${ty}, ${tz}).` };
  } catch (e) {
    bot.pathfinder.setGoal(null);
    await manualRoam(bot, longRangeExplore ? 45000 : 5500);
    const p = bot.entity?.position;
    const pos = p ? `(${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)})` : '(unknown)';
    return { success: true, reason: `Explore path failed (${e.message || 'path'}); manual roam to ${pos}.` };
  }
}

module.exports = { run };
