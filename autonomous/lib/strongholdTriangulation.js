'use strict';

const Vec3 = require('vec3');

/**
 * Convert Minecraft yaw (radians) to a horizontal forward unit vector (x, z). Y+ is up.
 */
function yawToForwardXZ(yaw) {
  return {
    x: -Math.sin(yaw),
    z: Math.cos(yaw),
  };
}

/**
 * Average two 2D directions (from eye throws) to refine stronghold hint on XZ plane.
 */
function mergeDirections(a, b) {
  if (!a) return b;
  if (!b) return a;
  const nx = a.x + b.x;
  const nz = a.z + b.z;
  const len = Math.hypot(nx, nz);
  if (len < 1e-6) return a;
  return { x: nx / len, z: nz / len };
}

/**
 * Extrapolate a world XZ point along direction from origin by distance blocks.
 */
function extrapolateXZ(origin, dir, distance) {
  const ox = typeof origin.x === 'number' ? origin.x : 0;
  const oy = typeof origin.y === 'number' ? origin.y : 64;
  const oz = typeof origin.z === 'number' ? origin.z : 0;
  const d = Math.max(0, distance);
  return new Vec3(ox + dir.x * d, oy, oz + dir.z * d);
}

module.exports = { yawToForwardXZ, mergeDirections, extrapolateXZ };
