'use strict';

/**
 * Documented blackboard keys written by skills / brain (for operators and future DAG planner).
 * Values are ad-hoc; this module only lists names — see writers in code.
 */
const BLACKBOARD_KEYS = Object.freeze([
  'spawnPos',
  'regionProtected',
  'blockedBreakCount',
  'authRequired',
  'authReady',
  'nearHostiles',
  'nearPassiveFood',
  'hasFoodInInventory',
  'miningMaxDistance',
  'gotoTestAngle',
  'jarvysVoice',
  'jarvysWaterWell',
  'netherPortalPos',
  'netherFortressHint',
  'strongholdEyeDir',
  'strongholdTravelHint',
  'strongholdPortalPos',
  'taskFailures',
  'taskCooldownUntil',
]);

module.exports = { BLACKBOARD_KEYS };
