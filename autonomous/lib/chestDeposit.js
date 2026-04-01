'use strict';

const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { chunkOrigin } = require('./chunkMissionState');
const { inventoryItems } = require('./food');

const GOTO_MS = parseInt(process.env.CHUNK_CHEST_GOTO_MS || '28000', 10);

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

function chestWindowEmptySlots(chest) {
  try {
    if (chest && typeof chest.emptySlotCount === 'function') return chest.emptySlotCount();
    const slots = chest?.window?.slots;
    if (Array.isArray(slots)) {
      let free = 0;
      const end = Math.min(slots.length, 54);
      for (let i = 0; i < end; i++) {
        if (!slots[i]) free++;
      }
      return free;
    }
  } catch (e) { /* ignore */ }
  return 12;
}

/**
 * Find nearest chest/barrel block whose center lies in the given chunk.
 */
function findChestBlockInChunk(bot, chunkX, chunkZ, maxDistance = 72) {
  const { minX, minZ } = chunkOrigin(chunkX, chunkZ);
  const maxX = minX + 15;
  const maxZ = minZ + 15;
  const positions = bot.findBlocks({
    point: bot.entity.position,
    matching: (b) => b && (b.name === 'chest' || b.name === 'trapped_chest' || b.name === 'barrel'),
    maxDistance,
    count: 512,
  });
  let best = null;
  let bestD = Infinity;
  const pos = bot.entity.position;
  for (const p of positions) {
    const bx = p.x;
    const bz = p.z;
    if (bx < minX || bx > maxX || bz < minZ || bz > maxZ) continue;
    const d = pos.distanceTo(p.offset(0.5, 0.5, 0.5));
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best ? bot.blockAt(best) : null;
}

function buildWhitelistSet(extra = []) {
  const { EDIBLE_PRIORITY, MEAT_NAMES } = require('./food');
  const w = new Set([
    'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe',
    'wooden_shovel', 'stone_shovel', 'iron_shovel', 'golden_shovel', 'diamond_shovel', 'netherite_shovel',
    'bucket', 'water_bucket', 'lava_bucket',
    'ladder', 'scaffolding',
    'torch', 'soul_torch',
    'crafting_table', 'chest',
    'stone_sword', 'iron_sword', 'golden_sword', 'diamond_sword', 'netherite_sword', 'wooden_sword',
    'stick', 'iron_ingot', 'flint_and_steel',
    ...EDIBLE_PRIORITY,
    ...MEAT_NAMES,
    'rotten_flesh', 'spider_eye', 'poisonous_potato',
    ...extra,
  ]);
  return w;
}

/**
 * Deposit all inventory items not in whitelist into a chest in the storage chunk.
 * @returns {Promise<{ success: boolean, reason: string, deposited?: number }>}
 */
async function depositAllExceptWhitelist(bot, state, options = {}) {
  const {
    chunkX,
    chunkZ,
    whitelist = buildWhitelistSet(options.extraWhitelist || []),
    maxDepositPerCall = 256,
  } = options;

  if (!bot?.pathfinder) {
    return { success: false, reason: 'No pathfinder.' };
  }
  if (chunkX == null || chunkZ == null) {
    return { success: false, reason: 'Storage chunk not set.' };
  }

  const block = findChestBlockInChunk(bot, chunkX, chunkZ, options.maxDistance ?? 80);
  if (!block) {
    return { success: false, reason: 'NO_CHEST: no chest/barrel in storage chunk.' };
  }

  try {
    await gotoTimeout(bot, new GoalGetToBlock(block.position.x, block.position.y, block.position.z), GOTO_MS);
  } catch (e) {
    return { success: false, reason: `Cannot reach chest: ${e.message || e}.` };
  }

  let chest;
  try {
    chest = await bot.openChest(block);
  } catch (e) {
    return { success: false, reason: `openChest failed: ${e.message || e}.` };
  }

  let deposited = 0;
  try {
    const itemsToDeposit = inventoryItems(bot).filter((it) => it && it.name && !whitelist.has(it.name));
    if (itemsToDeposit.length === 0) {
      await bot.closeWindow(chest);
      return { success: true, reason: 'Solo ítems de la whitelist; nada que depositar.' };
    }

    const emptyStart = chestWindowEmptySlots(chest);
    if (emptyStart < 2) {
      await bot.closeWindow(chest);
      return { success: false, reason: 'CHEST_FULL: storage chest has almost no free slots.' };
    }

    const items = inventoryItems(bot);
    for (const it of items) {
      if (!it || !it.name || whitelist.has(it.name)) continue;
      if (deposited >= maxDepositPerCall) break;
      const left = chestWindowEmptySlots(chest);
      if (left < 1) break;
      const n = Math.min(it.count, maxDepositPerCall - deposited, 64);
      if (n <= 0) break;
      try {
        await chest.deposit(it.type, it.metadata ?? null, n);
        deposited += n;
      } catch (e) {
        break;
      }
    }
  } finally {
    try { await bot.closeWindow(chest); } catch (e) {}
  }

  return {
    success: deposited > 0 || emptySlotCount(bot) >= 8,
    deposited,
    reason: deposited > 0 ? `Deposited ${deposited} items into storage chunk.` : 'Nothing to deposit or all whitelisted.',
  };
}

function emptySlotCount(bot) {
  try {
    if (typeof bot.inventory?.emptySlotCount === 'function') return bot.inventory.emptySlotCount();
  } catch (e) {}
  const inv = bot.inventory;
  if (!Array.isArray(inv?.slots)) return 0;
  const start = inv.inventoryStart ?? 9;
  const end = inv.inventoryEnd ?? 45;
  let n = 0;
  for (let i = start; i < end; i++) {
    if (!inv.slots[i]) n++;
  }
  return n;
}

/**
 * Surface block center of chunk for placement (best-effort Y from bot).
 */
function storageChunkPlaceTarget(chunkX, chunkZ, surfaceY) {
  const { minX, minZ } = chunkOrigin(chunkX, chunkZ);
  return { x: minX + 8, y: surfaceY, z: minZ + 8 };
}

module.exports = {
  findChestBlockInChunk,
  depositAllExceptWhitelist,
  buildWhitelistSet,
  storageChunkPlaceTarget,
  chestWindowEmptySlots,
  emptySlotCount,
};
