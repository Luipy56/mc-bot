'use strict';

const Vec3 = require('vec3');
const { setBlackboard } = require('./state');

const PATH_FAIL_STREAK_UNSTUCK = Math.max(2, parseInt(process.env.PATH_FAIL_STREAK_UNSTUCK || '2', 10));
const PATH_FAIL_STREAK_EXPLORE = Math.max(3, parseInt(process.env.PATH_FAIL_STREAK_EXPLORE || '4', 10));

/**
 * Heuristic: failure was likely movement/pathfinding, not missing items.
 */
function isPathLikeFailure(reason) {
  const s = String(reason || '').toLowerCase();
  if (!s) return false;
  return /path|timeout|goal|goto|unreachable|took too long|pathfind|timed out|no path|scoring|movement|can't reach|cannot reach|stuck|blocked break|protected|claim|lava|obsidian.*pick|reach|chest|open|dig.*timed|softlock|unbreakable|digging aborted|multi-minute|wrong tool/i.test(
    s
  );
}

function notePathOutcome(state, taskId, success, reason) {
  if (!state?.blackboard) return;
  if (success) {
    setBlackboard(state, 'pathStreak', 0);
    setBlackboard(state, 'unstuckFailStreak', 0);
    return;
  }
  if (!taskId || taskId === 'idle' || taskId === 'unstuck_recover' || taskId === 'explore_nearby' || taskId === 'retreat') {
    if (taskId === 'unstuck_recover' && !success) {
      const u = (state.blackboard.unstuckFailStreak || 0) + 1;
      setBlackboard(state, 'unstuckFailStreak', u);
    }
    return;
  }
  if (isPathLikeFailure(reason)) {
    const n = (state.blackboard.pathStreak || 0) + 1;
    setBlackboard(state, 'pathStreak', n);
    setBlackboard(state, 'lastPathTaskId', taskId);
  } else {
    setBlackboard(state, 'pathStreak', 0);
  }
}

/**
 * Next high-priority recovery task, or null (caller: brain after critical interrupt).
 * During chunk mission, avoid explore_nearby (would abandon the dig); use deeper local unstuck instead.
 */
function nextRecoveryTask(state) {
  const ps = state?.blackboard?.pathStreak ?? 0;
  if (ps < PATH_FAIL_STREAK_UNSTUCK) return null;

  const chunkActive = Boolean(state?.blackboard?.chunkMission?.active);

  if (ps >= PATH_FAIL_STREAK_EXPLORE && !chunkActive) {
    const forTask = state.blackboard?.lastPathTaskId || 'collect_wood';
    return {
      taskId: 'explore_nearby',
      params: { forTask },
      reason: 'Muchos fallos de path seguidos; explorar para cargar terreno y desatascar.',
    };
  }

  return {
    taskId: 'unstuck_recover',
    params: ps >= PATH_FAIL_STREAK_EXPLORE && chunkActive ? { deep: true } : {},
    reason: chunkActive && ps >= PATH_FAIL_STREAK_EXPLORE
      ? 'Misión chunk: muchos fallos de path; recuperación local reforzada (sin alejarse).'
      : 'Fallos de movimiento/path; intento de desbloqueo local.',
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isSafeToDigUnderfoot(name) {
  if (!name) return false;
  if (name === 'lava' || name.includes('lava')) return false;
  if (name === 'bedrock') return false;
  return /stone|cobble|deepslate|dirt|grass|sand|gravel|netherrack|end_stone|andesite|diorite|granite|wood|log|planks/i.test(
    name
  );
}

/**
 * Physical recovery: clear goals, nudge movement, dig feet/head if trapped, short roam.
 * @returns {Promise<{ success: boolean, reason: string }>}
 */
async function runUnstuckRoutine(bot, state) {
  if (!bot?.entity) {
    return { success: false, reason: 'No entity.' };
  }

  try {
    bot.pathfinder?.setGoal(null);
  } catch (e) {}

  const pos = bot.entity.position;
  const fx = Math.floor(pos.x);
  const fy = Math.floor(pos.y);
  const fz = Math.floor(pos.z);

  try {
    const yaw = (bot.entity.yaw || 0) + (Math.random() - 0.5) * 2.2;
    await bot.look(yaw, Math.max(-0.45, Math.min(0.45, (bot.entity.pitch || 0) + (Math.random() - 0.5) * 0.4)), true);
  } catch (e) {}

  bot.setControlState('sprint', true);
  bot.setControlState('forward', true);
  if (Math.random() < 0.45) bot.setControlState(Math.random() < 0.5 ? 'left' : 'right', true);
  await sleep(280 + Math.floor(Math.random() * 420));
  try {
    bot.setControlState('forward', false);
    bot.setControlState('left', false);
    bot.setControlState('right', false);
    bot.setControlState('sprint', false);
  } catch (e) {}

  try {
    bot.setControlState('jump', true);
    await sleep(160);
    bot.setControlState('jump', false);
  } catch (e) {}

  const under = bot.blockAt(new Vec3(fx, fy - 1, fz));
  if (under && isSafeToDigUnderfoot(under.name) && typeof bot.canDigBlock === 'function' && bot.canDigBlock(under)) {
    try {
      const tool = bot.pathfinder?.bestHarvestTool ? bot.pathfinder.bestHarvestTool(under) : null;
      if (tool) {
        const it = bot.inventory.items().find((i) => i.name === tool.name);
        if (it) await bot.equip(it, 'hand');
      }
      await bot.dig(under);
      await sleep(200);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes("can't break") || msg.includes('protected')) {
        setBlackboard(state, 'regionProtected', true);
      }
    }
  }

  const head = bot.blockAt(new Vec3(fx, fy + 1, fz));
  if (head && head.name && head.name !== 'air' && head.name !== 'cave_air' && head.name !== 'void_air') {
    if (typeof bot.canDigBlock === 'function' && bot.canDigBlock(head)) {
      try {
        const tool = bot.pathfinder?.bestHarvestTool ? bot.pathfinder.bestHarvestTool(head) : null;
        if (tool) {
          const it = bot.inventory.items().find((i) => i.name === tool.name);
          if (it) await bot.equip(it, 'hand');
        }
        await bot.dig(head);
        await sleep(200);
      } catch (e) { /* ignore */ }
    }
  }

  const feet = bot.blockAt(new Vec3(fx, fy, fz));
  const inFluid = feet && (feet.name === 'water' || feet.name === 'flowing_water' || feet.name === 'lava' || String(feet.name).includes('water'));
  if (inFluid) {
    try {
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      await sleep(900);
      bot.setControlState('forward', false);
      bot.setControlState('jump', false);
    } catch (e) {}
  }

  try {
    const y2 = bot.entity.yaw ?? 0;
    await bot.look(y2 + (Math.random() - 0.5) * 1.4, 0, true);
  } catch (e) {}

  return { success: true, reason: 'Unstuck: goal cleared, nudged, feet/head dig if needed.' };
}

module.exports = {
  isPathLikeFailure,
  notePathOutcome,
  nextRecoveryTask,
  runUnstuckRoutine,
  PATH_FAIL_STREAK_UNSTUCK,
  PATH_FAIL_STREAK_EXPLORE,
};
