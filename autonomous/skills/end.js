'use strict';

const { GoalGetToBlock, GoalFollow, GoalNear } = require('mineflayer-pathfinder').goals;
const { countItems } = require('../lib/inventoryQuery');
const { setBlackboard } = require('../lib/state');
const { yawToForwardXZ, mergeDirections, extrapolateXZ } = require('../lib/strongholdTriangulation');

/**
 * End-phase skills: craft_eyes_of_ender, find_stronghold, fill_end_portal, enter_end,
 * destroy_end_crystals, kill_ender_dragon.
 */
async function runCraftEyes(bot, state, params) {
  const craftingSkill = require('./crafting');
  const need = params.count ?? 12;
  if (countItems(bot, 'ender_eye') >= need) return { success: true, reason: 'Enough eyes of ender.' };

  const maxOps = Math.max(need, 24);
  for (let i = 0; i < maxOps && countItems(bot, 'ender_eye') < need; i++) {
    const blazes = countItems(bot, 'blaze_powder');
    const pearls = countItems(bot, 'ender_pearl');
    if (blazes < 1 || pearls < 1) {
      return { success: false, reason: 'Need blaze powder and ender pearls.' };
    }
    const r = await craftingSkill.run(bot, state, { itemName: 'ender_eye', count: 1 });
    if (!r.success) return r;
  }
  return {
    success: countItems(bot, 'ender_eye') >= need,
    reason: countItems(bot, 'ender_eye') >= need ? 'Crafted enough eyes of ender.' : 'Could not craft full stack of eyes.',
  };
}

function portalFrameNeedsEye(block) {
  if (!block || block.name !== 'end_portal_frame') return false;
  const props = block.properties || {};
  const eye = props.eye;
  if (eye === true || eye === 'true') return false;
  return true;
}

async function runFindStronghold(bot, state, params) {
  let portal = bot.findBlock({ matching: (b) => b.name === 'end_portal_frame', maxDistance: 96 });
  if (portal) {
    try {
      const goal = new GoalGetToBlock(portal.position.x, portal.position.y, portal.position.z);
      await bot.pathfinder.goto(goal);
      setBlackboard(state, 'strongholdPortalPos', {
        x: portal.position.x,
        y: portal.position.y,
        z: portal.position.z,
      });
      return { success: true, reason: 'Reached stronghold portal frame.' };
    } catch (e) {
      return { success: false, reason: e.message || 'Could not reach stronghold.' };
    }
  }

  const eye = bot.inventory.items().find((i) => i.name === 'ender_eye');
  if (!eye) {
    return { success: false, reason: 'No eyes of ender to throw.' };
  }

  let mergedDir = state.blackboard?.strongholdEyeDir || null;
  const maxThrows = parseInt(process.env.EYE_OF_ENDER_THROWS || '12', 10);

  for (let t = 0; t < maxThrows; t++) {
    portal = bot.findBlock({ matching: (b) => b.name === 'end_portal_frame', maxDistance: 128 });
    if (portal) {
      try {
        const goal = new GoalGetToBlock(portal.position.x, portal.position.y, portal.position.z);
        await bot.pathfinder.goto(goal);
        setBlackboard(state, 'strongholdPortalPos', {
          x: portal.position.x,
          y: portal.position.y,
          z: portal.position.z,
        });
        return { success: true, reason: 'Found stronghold after using eyes.' };
      } catch (e) {
        return { success: false, reason: e.message || 'Could not reach frame.' };
      }
    }

    try {
      await bot.equip(eye, 'hand');
      const dirBefore = yawToForwardXZ(bot.entity.yaw);
      bot.activateItem();
      await new Promise((r) => setTimeout(r, 3200));
      bot.deactivateItem?.();
      mergedDir = mergeDirections(mergedDir, dirBefore);
      if (mergedDir) {
        setBlackboard(state, 'strongholdEyeDir', mergedDir);
        const hint = extrapolateXZ(bot.entity.position, mergedDir, 800);
        setBlackboard(state, 'strongholdTravelHint', { x: hint.x, y: hint.y, z: hint.z });
      }
    } catch (e) { /* ignore single throw */ }
  }

  return { success: false, reason: 'Stronghold not found; explore toward strongholdTravelHint or walk eye direction.' };
}

async function runFillEndPortal(bot, state, params) {
  const active = bot.findBlock({ matching: (b) => b.name === 'end_portal', maxDistance: 24 });
  if (active) return { success: true, reason: 'End portal already active.' };

  const maxPlacements = parseInt(params.maxPerRun ?? '6', 10);
  let placedThisRun = 0;

  for (let attempt = 0; attempt < 24; attempt++) {
    const nowOpen = bot.findBlock({ matching: (b) => b.name === 'end_portal', maxDistance: 24 });
    if (nowOpen) return { success: true, reason: 'End portal activated.' };

    const block = bot.findBlock({
      matching: (b) => b && b.name === 'end_portal_frame' && portalFrameNeedsEye(b),
      maxDistance: 40,
    });
    if (!block) {
      const anyFrame = bot.findBlock({ matching: (b) => b.name === 'end_portal_frame', maxDistance: 48 });
      if (!anyFrame) return { success: false, reason: 'No end portal frames nearby.' };
      return {
        success: false,
        reason: 'Could not find empty frame slot (move closer / different angle).',
      };
    }

    if (countItems(bot, 'ender_eye') < 1) {
      return { success: false, reason: 'Out of eyes while filling portal.' };
    }
    if (placedThisRun >= maxPlacements) {
      return { success: false, reason: 'Placed some eyes; repeat task until portal opens.' };
    }

    const fp = block.position;
    try {
      const goal = new GoalNear(fp.x, fp.y, fp.z, 2.5);
      await bot.pathfinder.goto(goal);
    } catch (e) {
      continue;
    }

    const eyeItem = bot.inventory.items().find((i) => i.name === 'ender_eye');
    if (!eyeItem) return { success: false, reason: 'No ender eye in inventory.' };

    try {
      await bot.equip(eyeItem, 'hand');
      await bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
      await bot.activateBlock(block);
      await new Promise((r) => setTimeout(r, 450));
      placedThisRun++;
    } catch (e) {
      /* try next frame */
    }
  }

  const finalPortal = bot.findBlock({ matching: (b) => b.name === 'end_portal', maxDistance: 24 });
  if (finalPortal) return { success: true, reason: 'End portal activated.' };
  return { success: false, reason: 'More eyes or pathing needed to finish portal.' };
}

async function runEnterEnd(bot, state, params) {
  const portal = bot.findBlock({ matching: (b) => b.name === 'end_portal', maxDistance: 24 });
  if (!portal) return { success: false, reason: 'No active End portal nearby (fill frame with eyes).' };
  try {
    const goal = new GoalGetToBlock(portal.position.x, portal.position.y, portal.position.z);
    await bot.pathfinder.goto(goal);
    await bot.activateBlock(portal);
    await new Promise((r) => setTimeout(r, 4000));
    return { success: true, reason: 'Entered End dimension.' };
  } catch (e) {
    return { success: false, reason: e.message || 'Enter failed.' };
  }
}

async function destroyOneCrystal(bot, crystal, maxSteps = 14) {
  const { GoalFollow } = require('mineflayer-pathfinder').goals;
  const anchor = crystal.position;
  try {
    bot.pathfinder.setGoal(new GoalFollow(crystal, 2.2), true);
    for (let s = 0; s < maxSteps; s++) {
      const c = bot.nearestEntity(
        (e) => e.name === 'end_crystal' && e.position.distanceTo(anchor) < 2.5
      );
      if (!c) return true;
      try {
        const p = c.position;
        const lookAt = p.offset ? p.offset(0, 0.5, 0) : { x: p.x, y: p.y + 0.5, z: p.z };
        await bot.lookAt(lookAt);
        await bot.attack(c);
      } catch (e) { /* continue */ }
      await new Promise((r) => setTimeout(r, 280));
    }
  } finally {
    try { bot.pathfinder.setGoal(null); } catch (e) {}
  }
  return !bot.nearestEntity((e) => e.name === 'end_crystal' && e.position.distanceTo(anchor) < 2.5);
}

async function runDestroyEndCrystals(bot, state, params) {
  const maxPasses = parseInt(params.maxPasses ?? '24', 10);
  for (let pass = 0; pass < maxPasses; pass++) {
    const crystal = bot.nearestEntity(
      (e) => e.name === 'end_crystal' && e.position.distanceTo(bot.entity.position) < 96
    );
    if (!crystal) {
      return { success: true, reason: 'No end crystals remain (or none loaded).' };
    }
    await destroyOneCrystal(bot, crystal);
  }
  const left = bot.nearestEntity((e) => e.name === 'end_crystal' && e.position.distanceTo(bot.entity.position) < 96);
  return {
    success: !left,
    reason: left ? 'Crystals still present; move closer to pillars.' : 'End crystals destroyed.',
  };
}

function dragonLikelyPerching(dragon) {
  if (!dragon || !dragon.position) return false;
  const p = dragon.position;
  const y = p.y;
  const x = p.x;
  const z = p.z;
  if (y == null || x == null || z == null) return false;
  const nearOrigin = Math.abs(x) < 12 && Math.abs(z) < 12;
  return nearOrigin && y > 60 && y < 95;
}

async function runKillDragon(bot, state, params) {
  const maxTicks = params.maxTicks ?? 400;
  let noDragonStreak = 0;
  let sawDragon = false;
  const crystalPasses = parseInt(params.crystalPassesPerTick ?? '1', 10);

  for (let i = 0; i < maxTicks; i++) {
    const crystal = bot.nearestEntity(
      (e) => e.name === 'end_crystal' && e.position.distanceTo(bot.entity.position) < 100
    );
    if (crystal) {
      for (let c = 0; c < crystalPasses; c++) {
        await destroyOneCrystal(bot, crystal, 6);
      }
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }

    const dragon = bot.nearestEntity((e) => e.name === 'ender_dragon');
    if (!dragon) {
      noDragonStreak++;
      if (sawDragon && noDragonStreak >= 25) {
        return { success: true, reason: 'Ender Dragon defeated (gone after combat).' };
      }
      if (!sawDragon && noDragonStreak >= 40) {
        return { success: true, reason: 'No dragon loaded (dimension empty or already beaten).' };
      }
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    sawDragon = true;
    noDragonStreak = 0;

    try {
      const perch = dragonLikelyPerching(dragon);
      const dist = dragon.position.distanceTo(bot.entity.position);
      if (perch && dist < 7) {
        bot.pathfinder.setGoal(null);
        const p = dragon.position;
        const lookAt = p.offset ? p.offset(0, 1.5, 0) : { x: p.x, y: p.y + 1.5, z: p.z };
        await bot.lookAt(lookAt);
        await bot.attack(dragon);
      } else {
        bot.pathfinder.setGoal(new GoalFollow(dragon, perch ? 3.5 : 5), true);
        const p = dragon.position;
        const lookAt = p.offset ? p.offset(0, 2, 0) : { x: p.x, y: p.y + 2, z: p.z };
        await bot.lookAt(lookAt);
        await bot.attack(dragon);
      }
    } catch (e) {
      try { bot.pathfinder.setGoal(null); } catch (e2) {}
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  try { bot.pathfinder.setGoal(null); } catch (e) {}
  return { success: true, reason: 'Dragon combat tick budget exhausted; loop may resume.' };
}

const runners = {
  craft_eyes_of_ender: runCraftEyes,
  find_stronghold: runFindStronghold,
  fill_end_portal: runFillEndPortal,
  enter_end: runEnterEnd,
  destroy_end_crystals: runDestroyEndCrystals,
  kill_ender_dragon: runKillDragon,
};

async function run(bot, state, params) {
  const key = params._taskId || state._currentTaskId;
  const fn = runners[key];
  if (fn) return fn(bot, state, params);
  return { success: false, reason: 'Unknown end task.' };
}

module.exports = {
  run,
  runCraftEyes,
  runFindStronghold,
  runFillEndPortal,
  runEnterEnd,
  runDestroyEndCrystals,
  runKillDragon,
};
