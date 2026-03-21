'use strict';

/**
 * Break combat pathfinding and sprint away from nearest hostile.
 * params: { urgency?: string }
 */
async function run(bot, state, params = {}) {
  if (!bot.entity) return { success: false, reason: 'No entity.' };

  try {
    bot.pathfinder?.setGoal(null);
  } catch (e) {}

  let nearest = null;
  let bestD = Infinity;
  const pos = bot.entity.position;
  if (bot.entities) {
    for (const id of Object.keys(bot.entities)) {
      const e = bot.entities[id];
      if (!e || !e.position || !e.name) continue;
      const hostile = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'husk', 'drowned', 'phantom'].includes(e.name);
      if (!hostile) continue;
      const d = e.position.distanceTo(pos);
      if (d < bestD && d < 32) {
        bestD = d;
        nearest = e;
      }
    }
  }

  if (nearest && nearest.position) {
    const dx = pos.x - nearest.position.x;
    const dz = pos.z - nearest.position.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const nx = dx / len;
    const nz = dz / len;
    const yaw = Math.atan2(-nx, -nz);
    try {
      await bot.look(yaw, 0, true);
    } catch (e) {}
  }

  const ms = params.urgency === 'high' ? 3500 : 2200;
  bot.setControlState('sprint', true);
  bot.setControlState('forward', true);
  await new Promise((r) => setTimeout(r, ms));
  bot.setControlState('forward', false);
  bot.setControlState('sprint', false);

  return { success: true, reason: 'Retreated from threats.' };
}

module.exports = { run };
