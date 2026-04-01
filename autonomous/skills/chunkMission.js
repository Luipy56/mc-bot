'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock, GoalNear } = require('mineflayer-pathfinder').goals;
const { setBlackboard } = require('../lib/state');
const { countItems } = require('../lib/inventoryQuery');
const {
  chunkOrigin,
  requiredLadderCount,
  minFoodUnits,
  isInChunk,
  storageChunkCoords,
  DEFAULT_BLOCKS_PER_STEP,
  SECURE_EVERY_STRIP_STEPS,
} = require('../lib/chunkMissionState');
const {
  depositAllExceptWhitelist,
  buildWhitelistSet,
  emptySlotCount,
  findChestBlockInChunk,
} = require('../lib/chestDeposit');
const { countItemsByNames, EDIBLE_PRIORITY, MEAT_NAMES } = require('../lib/food');
const { HOSTILE_NAMES } = require('../lib/situation');
const craftingSkill = require('./crafting');
const miningSkill = require('./mining');
const huntingSkill = require('./hunting');
const buildingSkill = require('./building');
const fillWaterBucketSkill = require('./fillWaterBucket');
const humanPlayer = require('../lib/humanPlayer');
const { runUnstuckRoutine } = require('../lib/unstuck');
const { shouldAbortMiningBlock, digWithSoftlockGuard } = require('../lib/mineability');
const { maybeAskMiningToolHelp } = require('../lib/miningHelpChat');

const GOTO_MS = parseInt(process.env.CHUNK_STRIP_GOTO_MS || '22000', 10);
const PICK_NAMES = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
const SHOVEL_NAMES = ['netherite_shovel', 'diamond_shovel', 'iron_shovel', 'stone_shovel', 'wooden_shovel'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function gotoTimeout(bot, goal, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try { bot.pathfinder?.setGoal(null); } catch (e) {}
      reject(new Error('goto timeout'));
    }, ms);
    bot.pathfinder.goto(goal).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function isAirLike(name) {
  return !name || name === 'air' || name === 'cave_air' || name === 'void_air';
}

function bestPickName(bot) {
  for (const n of PICK_NAMES) {
    if (countItems(bot, n) >= 1) return n;
  }
  return null;
}

function bestShovelName(bot) {
  for (const n of SHOVEL_NAMES) {
    if (countItems(bot, n) >= 1) return n;
  }
  return null;
}

function hasBucket(bot) {
  return countItems(bot, 'bucket') >= 1 || countItems(bot, 'water_bucket') >= 1;
}

function countEdible(bot) {
  return countItemsByNames(bot, [...EDIBLE_PRIORITY, ...MEAT_NAMES, 'rotten_flesh']);
}

function estimateSurfaceY(bot, minX, minZ) {
  const cx = minX + 8;
  const cz = minZ + 8;
  for (let y = 320; y > -64; y--) {
    const b = bot.blockAt(new Vec3(cx, y, cz));
    if (b && !isAirLike(b.name) && !b.name.includes('snow')) return y;
  }
  return bot.entity ? Math.floor(bot.entity.position.y) : 80;
}

function nearestHostileEntity(bot, maxDist) {
  if (!bot.entity || !bot.entities) return null;
  const pos = bot.entity.position;
  let best = null;
  let bestD = Infinity;
  for (const id of Object.keys(bot.entities)) {
    const e = bot.entities[id];
    if (!e || !e.position || !e.name || !e.isValid) continue;
    if (!HOSTILE_NAMES.has(e.name)) continue;
    const d = e.position.distanceTo(pos);
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

async function combatHostilesBrief(bot, state) {
  const { GoalFollow } = require('mineflayer-pathfinder').goals;
  const target = nearestHostileEntity(bot, 14);
  if (!target) return { success: true, reason: 'No hostiles in range.' };
  const t0 = Date.now();
  const maxMs = 12000;
  while (Date.now() - t0 < maxMs && target.isValid) {
    const d = target.position.distanceTo(bot.entity.position);
    if (d > 16) break;
    if (bot.health < 7) {
      try { bot.pathfinder.setGoal(null); } catch (e) {}
      return { success: false, reason: 'Low health during combat.' };
    }
    try {
      bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
    } catch (e) {}
    if (d <= 3.5) {
      try {
        await bot.lookAt(target.position.offset(0, 1, 0), true);
        await bot.attack(target);
      } catch (e) {}
    }
    await sleep(450);
    if (!target.isValid) break;
  }
  try { bot.pathfinder.setGoal(null); } catch (e) {}
  return { success: true, reason: 'Combat round done.' };
}

async function placeOneLadder(bot) {
  const ladder = bot.inventory.items().find((i) => i.name === 'ladder');
  if (!ladder) return false;
  const pos = bot.entity.position;
  const p = new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const ref = bot.blockAt(p);
  if (!ref) return false;
  try {
    await bot.equip(ladder, 'hand');
    await bot.placeBlock(ref, new Vec3(0, 1, 0));
    return true;
  } catch (e) {
    return false;
  }
}

async function tryConvertAdjacentLava(bot, state, digPos) {
  const dirs = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  let lavaPos = null;
  for (const [dx, dy, dz] of dirs) {
    const b = bot.blockAt(digPos.offset(dx, dy, dz));
    if (b && String(b.name || '').includes('lava')) {
      lavaPos = b.position;
      break;
    }
  }
  if (!lavaPos) return { ok: true, reason: 'no lava' };
  const wb = bot.inventory.items().find((i) => i.name === 'water_bucket');
  if (!wb) return { ok: false, reason: 'lava nearby but no water bucket' };
  try {
    await bot.equip(wb, 'hand');
    const lavaBlock = bot.blockAt(lavaPos);
    if (!lavaBlock) return { ok: false, reason: 'lava gone' };
    await bot.lookAt(lavaBlock.position.offset(0.5, 1.0, 0.5), true);
    await bot.activateBlock(lavaBlock, new Vec3(0, 1, 0));
    await sleep(400);
    return { ok: true, reason: 'water on lava' };
  } catch (e) {
    return { ok: false, reason: e.message || 'lava convert failed' };
  }
}

async function digOneBlock(bot, state, block, mission) {
  if (!block || isAirLike(block.name)) return { dug: false, skip: true };
  if (typeof bot.canDigBlock === 'function' && !bot.canDigBlock(block)) {
    return { dug: false, skip: true };
  }
  const pre = shouldAbortMiningBlock(bot, block);
  if (pre.abort) {
    maybeAskMiningToolHelp(bot, state, pre);
    return { dug: false, skip: true, reason: pre.reason };
  }
  const lavaCheck = await tryConvertAdjacentLava(bot, state, block.position);
  if (!lavaCheck.ok && String(lavaCheck.reason || '').includes('lava')) {
    return { dug: false, skip: true };
  }
  const refreshed = bot.blockAt(block.position);
  if (!refreshed || isAirLike(refreshed.name)) return { dug: true, skip: false };
  const pre2 = shouldAbortMiningBlock(bot, refreshed);
  if (pre2.abort) {
    maybeAskMiningToolHelp(bot, state, pre2);
    return { dug: false, skip: true, reason: pre2.reason };
  }
  const bestTool = bot.pathfinder?.bestHarvestTool ? bot.pathfinder.bestHarvestTool(refreshed) : null;
  if (bestTool) {
    const tool = bot.inventory.items().find((i) => i.name === bestTool.name);
    if (tool) await bot.equip(tool, 'hand');
  }
  try {
    const dug = await digWithSoftlockGuard(bot, refreshed, state);
    if (!dug.ok) {
      return { dug: false, skip: true, reason: dug.reason || 'softlock guard' };
    }
    await humanPlayer.maybeMiningBeat(bot);
    return { dug: true, skip: false };
  } catch (e) {
    const low = String(e?.message || '').toLowerCase();
    if (low.includes("can't break") || low.includes('cannot break') || low.includes('protected')) {
      setBlackboard(state, 'regionProtected', true);
    }
    return { dug: false, skip: false, reason: e.message };
  }
}

function missionChunkHostiles(bot, chunkX, chunkZ) {
  if (!bot.entity) return 0;
  const minX = chunkX * 16;
  const maxX = minX + 15;
  const minZ = chunkZ * 16;
  const maxZ = minZ + 15;
  let n = 0;
  if (!bot.entities) return 0;
  for (const id of Object.keys(bot.entities)) {
    const e = bot.entities[id];
    if (!e || !e.position || !e.name) continue;
    if (!HOSTILE_NAMES.has(e.name)) continue;
    const x = e.position.x;
    const z = e.position.z;
    if (x >= minX - 2 && x <= maxX + 2 && z >= minZ - 2 && z <= maxZ + 2) n++;
  }
  return n;
}

async function secureChunkPerimeterOnce(bot, state, mission) {
  const { minX, minZ } = chunkOrigin(mission.chunkX, mission.chunkZ);
  const torch = bot.inventory.items().find((i) => i.name === 'torch');
  const fill = bot.inventory.items().find((i) =>
    ['cobblestone', 'dirt', 'cobbled_deepslate', 'andesite'].includes(i.name) && i.count > 4
  );
  let placed = 0;
  const y = Math.floor(bot.entity.position.y);
  const faces = [
    [minX - 1, minZ + 8], [minX + 16, minZ + 8], [minX + 8, minZ - 1], [minX + 8, minZ + 16],
  ];
  for (const [fx, fz] of faces) {
    if (placed >= 8) break;
    const b = bot.blockAt(new Vec3(fx, y, fz));
    if (!b || (!isAirLike(b.name) && b.name !== 'cave_air')) continue;
    const inX = fx < minX ? minX : fx > minX + 15 ? minX + 15 : fx;
    const inZ = fz < minZ ? minZ : fz > minZ + 15 ? minZ + 15 : fz;
    const insideSolid = bot.blockAt(new Vec3(inX, y, inZ));
    if (torch && insideSolid && !isAirLike(insideSolid.name)) {
      try {
        await gotoTimeout(bot, new GoalNear(inX, y, inZ, 2), Math.min(GOTO_MS, 12000));
        await bot.equip(torch, 'hand');
        const faceVec = fx < minX ? new Vec3(-1, 0, 0) : fx > minX + 15 ? new Vec3(1, 0, 0) : fz < minZ ? new Vec3(0, 0, -1) : new Vec3(0, 0, 1);
        await bot.placeBlock(insideSolid, faceVec);
        placed++;
      } catch (e) { /* ignore */ }
    }
    if (placed >= 8) break;
    if (fill && b && (isAirLike(b.name) || b.name === 'cave_air')) {
      const opensToChunk = isInChunk(inX, inZ, mission.chunkX, mission.chunkZ);
      if (opensToChunk) {
        try {
          await bot.equip(fill, 'hand');
          const below = bot.blockAt(new Vec3(fx, y - 1, fz));
          if (below && !isAirLike(below.name)) {
            await bot.placeBlock(below, new Vec3(0, 1, 0));
            placed++;
          }
        } catch (e) { /* ignore */ }
      }
    }
  }
  return { success: true, reason: `Secure: ~${placed} antorcha/bloque en perímetro.` };
}

async function gotoChunkCenter(bot, chunkX, chunkZ, yHint, state) {
  const { minX, minZ } = chunkOrigin(chunkX, chunkZ);
  const x = minX + 8;
  const z = minZ + 8;
  const goal = new GoalNear(x, yHint, z, 4);
  try {
    await gotoTimeout(bot, goal, GOTO_MS);
  } catch (e) {
    if (state) {
      try {
        await runUnstuckRoutine(bot, state);
      } catch (e2) { /* ignore */ }
    }
    await gotoTimeout(bot, goal, GOTO_MS);
  }
}

async function runPrepGear(bot, state, mission) {
  if (state?.blackboard?.regionProtected) {
    mission.active = false;
    mission.phase = 'complete';
    return { success: false, reason: 'Área protegida; misión cancelada.' };
  }
  if (!bestPickName(bot)) {
    const r = await craftingSkill.run(bot, state, { itemName: 'wooden_pickaxe', count: 1 });
    if (!r.success) {
      const w = await miningSkill.run(bot, state, { blockName: 'oak_log', count: 3 });
      if (!w.success) return w;
      await craftingSkill.run(bot, state, { itemName: 'oak_planks', count: 12 });
      await craftingSkill.run(bot, state, { itemName: 'stick', count: 8 });
      await craftingSkill.run(bot, state, { itemName: 'wooden_pickaxe', count: 1 });
    }
  }
  if (!bestShovelName(bot)) {
    await craftingSkill.run(bot, state, { itemName: 'wooden_shovel', count: 1 });
  }
  if (!hasBucket(bot) && countItems(bot, 'iron_ingot') >= 3) {
    await craftingSkill.run(bot, state, { itemName: 'bucket', count: 1 });
  }
  if (countItems(bot, 'bucket') >= 1 && countItems(bot, 'water_bucket') < 1) {
    await fillWaterBucketSkill.run(bot, state, { maxDistance: 96 }).catch(() => {});
  }
  const needLadders = requiredLadderCount(mission.surfaceY, mission.targetY);
  if (countItems(bot, 'ladder') < Math.min(needLadders, 64)) {
    if (countItems(bot, 'stick') < 21) {
      if (countAllPlanks(bot) < 8) {
        await miningSkill.run(bot, state, { blockName: 'oak_log', count: 4 });
      }
      await craftingSkill.run(bot, state, { itemName: 'oak_planks', count: 16 });
      await craftingSkill.run(bot, state, { itemName: 'stick', count: 32 });
    }
    await craftingSkill.run(bot, state, { itemName: 'ladder', count: 16 });
  }
  if (countItems(bot, 'torch') < 24) {
    await craftingSkill.run(bot, state, { itemName: 'torch', count: 16 }).catch(() => {});
  }
  mission.phase = 'prep_food';
  return { success: true, reason: 'Prep gear avanzado.' };
}

function countAllPlanks(bot) {
  const { countAllPlanks: cap } = require('../lib/inventoryQuery');
  return cap(bot);
}

async function runPrepFood(bot, state, mission) {
  const minF = minFoodUnits();
  if (countEdible(bot) < minF) {
    const h = await huntingSkill.run(bot, state, { maxDistance: 40, minMeat: 4, eatBelow: 18 });
    if (!h.success && countEdible(bot) < 8) {
      return { success: false, reason: 'Poca comida y hunt falló; acércame animales o comida.' };
    }
  }
  mission.phase = 'deposit_pre';
  return { success: true, reason: 'Comida suficiente para continuar.' };
}

async function runDepositPre(bot, state, mission) {
  const sc = storageChunkCoords(mission);
  const wl = buildWhitelistSet();
  const res = await depositAllExceptWhitelist(bot, state, {
    chunkX: sc.chunkX,
    chunkZ: sc.chunkZ,
    whitelist: wl,
  });
  if (!res.success && String(res.reason || '').includes('NO_CHEST')) {
    mission.phase = 'craft_storage';
    return { success: true, reason: 'Necesita cofre en chunk de almacén.' };
  }
  if (!res.success && String(res.reason || '').includes('CHEST_FULL')) {
    mission.phase = 'craft_storage';
    return { success: true, reason: 'Cofre lleno; haré otro.' };
  }
  mission.phase = 'strip';
  mission.stripY = mission.stripY == null ? mission.surfaceY : mission.stripY;
  return { success: true, reason: res.reason || 'Inventario vaciado (whitelist).' };
}

async function runCraftStorage(bot, state, mission) {
  const sc = storageChunkCoords(mission);
  if (countItems(bot, 'chest') < 1) {
    if (countAllPlanks(bot) < 8) {
      await miningSkill.run(bot, state, { blockName: 'oak_log', count: 4 });
      await craftingSkill.run(bot, state, { itemName: 'oak_planks', count: 16 });
    }
    const c = await craftingSkill.run(bot, state, { itemName: 'chest', count: 1 });
    if (!c.success) return c;
  }
  const { minX: smx, minZ: smz } = chunkOrigin(sc.chunkX, sc.chunkZ);
  const ySurf = estimateSurfaceY(bot, smx, smz);
  const t = { x: smx + 8, y: ySurf + 1, z: smz + 8 };
  await gotoChunkCenter(bot, sc.chunkX, sc.chunkZ, ySurf, state);
  const existing = findChestBlockInChunk(bot, sc.chunkX, sc.chunkZ, 24);
  if (existing) {
    mission.phase = 'deposit_pre';
    return { success: true, reason: 'Cofre ya existe en almacén.' };
  }
  const pl = await buildingSkill.run(bot, state, { blockName: 'chest', x: t.x, y: t.y, z: t.z });
  if (!pl.success) {
    const pl2 = await buildingSkill.run(bot, state, { blockName: 'chest' });
    if (!pl2.success) return pl2;
  }
  mission.phase = 'deposit_pre';
  return { success: true, reason: 'Cofre colocado en chunk adyacente.' };
}

async function runStripStep(bot, state, mission) {
  const { minX, minZ } = chunkOrigin(mission.chunkX, mission.chunkZ);
  if (mission.surfaceY == null || mission.surfaceY < mission.targetY) {
    mission.surfaceY = estimateSurfaceY(bot, minX, minZ);
  }
  const depthBelowSurface = mission.surfaceY - bot.entity.position.y;
  if (depthBelowSurface > 10 && countItems(bot, 'ladder') < Math.min(128, depthBelowSurface + 12)) {
    mission.phase = 'ladder_resupply';
    return { success: true, reason: 'Faltan escaleras para salir desde esta profundidad; reabastecimiento.' };
  }

  if (missionChunkHostiles(bot, mission.chunkX, mission.chunkZ) > 0 && nearestHostileEntity(bot, 10)) {
    mission.phase = 'hostile';
    return { success: true, reason: 'Hostiles en el chunk; combate.' };
  }

  if (emptySlotCount(bot) < 4) {
    mission.phase = 'deposit_inv';
    return { success: true, reason: 'Inventario lleno; deposito.' };
  }

  if (countEdible(bot) < 6 && bot.food != null && bot.food < 12) {
    mission.phase = 'prep_food';
    return { success: true, reason: 'Hambre baja; busco comida.' };
  }

  mission.secureTicker = (mission.secureTicker || 0) + 1;
  if (mission.secureTicker % SECURE_EVERY_STRIP_STEPS === 0) {
    await secureChunkPerimeterOnce(bot, state, mission);
  }

  const maxBlocks = DEFAULT_BLOCKS_PER_STEP;
  let mined = 0;
  let guard = 0;
  while (mined < maxBlocks && guard < 200) {
    guard++;
    if (mission.stripCz > 15) {
      mission.active = false;
      mission.phase = 'complete';
      const req = mission.requester;
      if (req) {
        try { bot.chat(`${req}: chunk (${mission.chunkX},${mission.chunkZ}) terminado hasta Y=${mission.targetY}.`); } catch (e) {}
      }
      return { success: true, reason: 'Misión chunk completa.' };
    }
    if (mission.stripY == null) mission.stripY = mission.surfaceY;
    if (mission.stripY < mission.targetY) {
      mission.stripCx++;
      if (mission.stripCx > 15) {
        mission.stripCx = 0;
        mission.stripCz++;
      }
      if (mission.stripCz > 15) continue;
      mission.stripY = mission.surfaceY;
    }
    const wx = minX + mission.stripCx;
    const wz = minZ + mission.stripCz;
    const wy = mission.stripY;
    const block = bot.blockAt(new Vec3(wx, wy, wz));
    mission.lastStrip = { x: wx, y: wy, z: wz };

    if (mission.stripCx === mission.shaftCx && mission.stripCz === mission.shaftCz && wy < mission.surfaceY) {
      await placeOneLadder(bot);
    }

    try {
      const goal = new GoalGetToBlock(wx, wy, wz);
      await gotoTimeout(bot, goal, GOTO_MS);
    } catch (e) {
      try {
        await runUnstuckRoutine(bot, state);
      } catch (e2) { /* ignore */ }
      mission.stripY--;
      continue;
    }

    const dig = await digOneBlock(bot, state, block, mission);
    if (state?.blackboard?.regionProtected) {
      mission.active = false;
      mission.phase = 'complete';
      return { success: false, reason: 'Claim/protección; misión abortada.' };
    }
    if (dig.skip && !dig.dug) {
      mission.stripY--;
      continue;
    }
    if (dig.dug) mined++;
    mission.stripY--;
  }

  mission.stripStepsDone = (mission.stripStepsDone || 0) + 1;
  return { success: true, reason: `Strip: ${mined} bloques (columna ${mission.stripCx},${mission.stripCz} Y${mission.stripY}).` };
}

async function runDepositInv(bot, state, mission) {
  const sc = storageChunkCoords(mission);
  const res = await depositAllExceptWhitelist(bot, state, {
    chunkX: sc.chunkX,
    chunkZ: sc.chunkZ,
    whitelist: buildWhitelistSet(),
  });
  if (!res.success && String(res.reason || '').includes('NO_CHEST')) {
    mission.phase = 'craft_storage';
  } else if (!res.success && String(res.reason || '').includes('CHEST_FULL')) {
    mission.phase = 'craft_storage';
  } else {
    mission.phase = 'strip';
  }
  return { success: true, reason: res.reason || 'Deposit mid-mission.' };
}

async function runLadderResupply(bot, state, mission) {
  await gotoChunkCenter(bot, mission.chunkX, mission.chunkZ, mission.surfaceY, state);
  if (countItems(bot, 'stick') < 7) {
    await miningSkill.run(bot, state, { blockName: 'oak_log', count: 6 });
    await craftingSkill.run(bot, state, { itemName: 'oak_planks', count: 24 });
    await craftingSkill.run(bot, state, { itemName: 'stick', count: 32 });
  }
  await craftingSkill.run(bot, state, { itemName: 'ladder', count: 24 });
  mission.phase = 'strip';
  return { success: true, reason: 'Escaleras crafteadas; vuelvo a picar.' };
}

async function runGotoSurface(bot, state, mission) {
  await gotoChunkCenter(bot, mission.chunkX, mission.chunkZ, mission.surfaceY + 10, state);
  mission.phase = 'prep_gear';
  return { success: true, reason: 'En superficie del chunk.' };
}

async function runRecovery(bot, state, mission) {
  const target = mission.lastStrip || { x: mission.chunkX * 16 + 8, y: mission.surfaceY, z: mission.chunkZ * 16 + 8 };
  try {
    const goal = new GoalNear(target.x, target.y, target.z, 3);
    await gotoTimeout(bot, goal, GOTO_MS * 2);
  } catch (e) {
    try {
      await runUnstuckRoutine(bot, state);
    } catch (e2) { /* ignore */ }
    try {
      await gotoChunkCenter(bot, mission.chunkX, mission.chunkZ, mission.surfaceY, state);
    } catch (e3) { /* ignore */ }
  }
  mission.pendingRecovery = false;
  mission.phase = mission.phaseBeforeDeath && mission.phaseBeforeDeath !== 'recovery' ? mission.phaseBeforeDeath : 'strip';
  mission.phaseBeforeDeath = null;
  return { success: true, reason: 'Recuperación de posición de misión.' };
}

async function runHostile(bot, state, mission) {
  const c = await combatHostilesBrief(bot, state);
  mission.phase = 'strip';
  return c;
}

async function run(bot, state) {
  const mission = state.blackboard?.chunkMission;
  if (!mission?.active) {
    return { success: false, reason: 'No hay misión chunk activa.' };
  }
  if (!bot.pathfinder) {
    return { success: false, reason: 'Pathfinder no cargado.' };
  }

  switch (mission.phase) {
    case 'recovery':
      return runRecovery(bot, state, mission);
    case 'prep_gear':
      return runPrepGear(bot, state, mission);
    case 'prep_food':
      return runPrepFood(bot, state, mission);
    case 'deposit_pre':
      return runDepositPre(bot, state, mission);
    case 'craft_storage':
      return runCraftStorage(bot, state, mission);
    case 'deposit_inv':
      return runDepositInv(bot, state, mission);
    case 'ladder_resupply':
      return runLadderResupply(bot, state, mission);
    case 'goto_surface':
      return runGotoSurface(bot, state, mission);
    case 'hostile':
      return runHostile(bot, state, mission);
    case 'strip':
      return runStripStep(bot, state, mission);
    default:
      mission.phase = 'strip';
      return { success: true, reason: 'Fase reset a strip.' };
  }
}

module.exports = { run, estimateSurfaceY, missionChunkHostiles };
