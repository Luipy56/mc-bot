'use strict';

/**
 * When a chunk strip mission is active, the main roadmap is paused and each loop runs chunk_mission_step.
 * @returns {{ taskId: string, params: object, reason: string } | null}
 */
function nextChunkMissionTask(state, _bot) {
  const m = state?.blackboard?.chunkMission;
  if (!m || !m.active) return null;
  if (m.phase === 'complete') return null;
  const phase = m.phase || 'prep_gear';
  return {
    taskId: 'chunk_mission_step',
    params: {},
    reason: `Misión picar chunk (${phase}) en (${m.chunkX}, ${m.chunkZ}) → Y≤${m.targetY}.`,
  };
}

module.exports = { nextChunkMissionTask };
