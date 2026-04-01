'use strict';

const DEFAULT_TARGET_Y = parseInt(process.env.CHUNK_STRIP_TARGET_Y || '-58', 10);
const DEFAULT_BLOCKS_PER_STEP = parseInt(process.env.CHUNK_STRIP_BLOCKS_PER_STEP || '48', 10);
const SECURE_EVERY_STRIP_STEPS = Math.max(1, parseInt(process.env.CHUNK_STRIP_SECURE_EVERY || '4', 10));

function blockToChunk(x, z) {
  return { chunkX: Math.floor(x / 16), chunkZ: Math.floor(z / 16) };
}

function chunkOrigin(chunkX, chunkZ) {
  return { minX: chunkX * 16, minZ: chunkZ * 16 };
}

function isInChunk(wx, wz, chunkX, chunkZ) {
  return Math.floor(wx / 16) === chunkX && Math.floor(wz / 16) === chunkZ;
}

/**
 * @param {{ x: number, y: number, z: number }} pos
 * @param {{ requester?: string, targetY?: number, storageDx?: number, storageDz?: number, phase?: string }} options
 */
function createChunkMissionFromPosition(pos, options = {}) {
  const fx = Math.floor(pos.x);
  const fy = Math.floor(pos.y);
  const fz = Math.floor(pos.z);
  const { chunkX, chunkZ } = blockToChunk(fx, fz);
  return {
    active: true,
    chunkX,
    chunkZ,
    targetY: options.targetY ?? DEFAULT_TARGET_Y,
    phase: options.phase || 'prep_gear',
    surfaceY: fy,
    storageDx: options.storageDx ?? 1,
    storageDz: options.storageDz ?? 0,
    stripCx: 0,
    stripCz: 0,
    stripY: null,
    shaftCx: 0,
    shaftCz: 0,
    chestPositions: [],
    stripStepsDone: 0,
    lastStrip: { x: fx, y: fy, z: fz },
    lastDeathPos: null,
    phaseBeforeDeath: null,
    pendingRecovery: false,
    requester: options.requester || '',
    failedReason: null,
    secureTicker: 0,
  };
}

function requiredLadderCount(surfaceY, targetY) {
  return Math.min(256, Math.max(32, surfaceY - targetY + 24));
}

function minFoodUnits() {
  return parseInt(process.env.CHUNK_STRIP_MIN_FOOD || '24', 10);
}

/**
 * @param {string} raw
 * @returns {{ action: 'start' | 'stop' } | null}
 */
function parseChunkStripChatMessage(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (t === '!chunkstrip' || t === '!picarchunk') return { action: 'start' };
  if (t === '!chunkstrip stop' || t === '!picarchunk stop' || t === '!chunkstrip cancel' || t === '!picarchunk cancel') {
    return { action: 'stop' };
  }
  return null;
}

function storageChunkCoords(mission) {
  return {
    chunkX: mission.chunkX + mission.storageDx,
    chunkZ: mission.chunkZ + mission.storageDz,
  };
}

module.exports = {
  blockToChunk,
  chunkOrigin,
  isInChunk,
  createChunkMissionFromPosition,
  requiredLadderCount,
  minFoodUnits,
  parseChunkStripChatMessage,
  storageChunkCoords,
  DEFAULT_TARGET_Y,
  DEFAULT_BLOCKS_PER_STEP,
  SECURE_EVERY_STRIP_STEPS,
};
