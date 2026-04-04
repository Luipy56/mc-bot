'use strict';

/**
 * Handlers for human-play backlog taskIds (human_human_*).
 * Most entries are stubs until planner conditions wire them; several delegate to existing extended skills.
 */

const milkCow = require('./milkCow');
const humanPlayer = require('../lib/humanPlayer');
const { sleep } = require('./extendedPlayerLib');
const handlersA = require('./extendedPlayerHandlersA');
const handlersB = require('./extendedPlayerHandlersB');
const EXT = { ...handlersA, ...handlersB };
const { HUMAN_PLAY_TASK_IDS } = require('../lib/humanPlayTaskIds');

function partial(msg) {
  return { success: false, reason: String(msg || 'partial') };
}

function delegate(extId) {
  return async function delegatedHumanPlay(bot, state, params) {
    const fn = EXT[extId];
    if (typeof fn !== 'function') {
      return partial(`humanPlay delegate: missing extended handler "${extId}".`);
    }
    return fn(bot, state, { ...params, _taskId: extId });
  };
}

async function humanPlayStub(bot, state, params) {
  const id = params._taskId || 'human_play_unknown';
  return {
    success: false,
    reason: `human_play_backlog: ${id} not automated (incremental implementation).`,
  };
}

async function leashVillagerEthics() {
  return {
    success: true,
    reason: 'Villager transport: use boat/minecart paths only; pit/leash traps not implemented.',
  };
}

async function parrotNoChocolate() {
  return {
    success: true,
    reason: 'Invariant: never feed cookies to parrots; bot has no parrot cookie action.',
  };
}

async function idleMicroYawNoise(bot, state, params) {
  if (!humanPlayer.isEnabled()) {
    return { success: true, reason: 'HUMAN_LIKE_PLAYER off; skip idle camera.' };
  }
  if (!bot.entity || typeof bot.look !== 'function') return partial('No entity / look.');
  const e = bot.entity;
  const yaw = e.yaw + (Math.random() - 0.5) * 0.14;
  const pitch = Math.max(-0.35, Math.min(0.35, e.pitch + (Math.random() - 0.5) * 0.08));
  try {
    await bot.look(yaw, pitch, true);
    await sleep(humanPlayer.randomBetween(25, 120));
  } catch (err) { /* ignore */ }
  return { success: true, reason: 'Idle micro-yaw jitter.' };
}

async function milkCowCooldownThrottle(bot, state, params) {
  if (!state.blackboard) state.blackboard = {};
  const now = Date.now();
  const last = state.blackboard.humanMilkCowAt || 0;
  if (now - last < 700) {
    return { success: false, reason: 'Cow milk spacing (throttle); wait for cooldown.' };
  }
  if (!bot.pathfinder) return partial('Pathfinder not loaded.');
  const r = await milkCow.run(bot, state, params);
  if (r.success) state.blackboard.humanMilkCowAt = Date.now();
  return r;
}

/** human_taskId -> extendedPlayerHandlers* key */
const DELEGATES = {
  human_human_near_player_arm_swing_greeting: 'wave_at_nearby_player',
  human_human_180_glance_hostile_rear: 'glance_behind',
  human_human_afk_fish_occasional_recast: 'fish_for_food',
  human_human_smoker_meat_priority: 'use_smoker',
  human_human_blast_furnace_ore_priority: 'use_blast_furnace',
  human_human_stonecutter_stair_macro: 'use_stonecutter',
  human_human_loom_banner_base_mark: 'use_loom',
  human_human_cartography_lock_map: 'use_cartography',
  human_human_grindstone_disenchant_junk_first: 'use_grindstone',
  human_human_grindstone_xp_bank_smelt: 'use_grindstone',
  human_human_golden_apple_clutch_threshold: 'eat_golden_apple',
  human_human_totem_offhand_swap_predict: 'use_totem',
  human_human_potion_splash_self_foot: 'splash_potion_combat',
  human_human_lingering_cloud_kite: 'splash_potion_combat',
  human_human_anchor_charge_respawn_nether: 'respawn_anchor_nether',
  human_human_bastion_chest_piglin_milk: 'barter_piglin',
  human_human_bucket_lava_nether_secure_bin: 'bucket_lava_safe',
  human_human_elytra_chorus_backup_slot: 'chorus_fruit_escape',
  human_human_firework_crossbow_rocket_elytra: 'firework_rocket_boost',
  human_human_bundle_sort_food_kelp: 'bundle_items',
  human_human_shulker_color_code_kits: 'shulker_box_kit',
  human_human_smithing_template_duping_skip: 'trim_armor_smithing',
  human_human_suspicious_sand_temple_care: 'brush_archaeology',
  human_human_fossil_bone_meal_brush: 'brush_archaeology',
  human_human_composter_return_bonemeal_loop: 'use_composter',
  human_human_kelp_block_fuel_buffer: 'smelt_dried_kelp',
  human_human_beehive_silk_night_harvest_safe: 'shear_hive',
  human_human_bee_angry_smoke_campfire_calm: 'collect_honey',
  human_human_warden_darkness_panic_torch: 'place_torch_hostile_cave',
  human_human_sculk_sensor_sneak_crouch_base: 'sneak_bridge_void',
  human_human_endermite_pearl_minimal_use: 'throw_pearl_escape',
  human_human_minecart_furnace_boost_burst: 'ride_minecart',
  human_human_bamboo_raft_river_cross: 'ride_boat',
  human_human_boat_jump_momentum_skip: 'ride_boat',
  human_human_water_elevator_bubble_column: 'place_blocks_fill',
  human_human_hopper_minecart_under_furnace: 'auto_furnace_fuel_line',
  human_human_lever_cart_station_hop: 'ride_minecart',
  human_human_pumpkin_face_carve_before_place: 'carve_pumpkin',
  human_human_witch_milk_after_poison: 'drink_milk_clear_effects',
  human_human_prefer_cooked_meat_raw: 'consume_cooked_meat',
  human_human_hotbar_order_tool_blocks_food: 'organize_chest_tabs',
  human_human_bookshelf_enchant_power_ring: 'enchant_at_table',
  human_human_redstone_lamp_floor_night: 'redstone_door_trap',
  human_human_piston_door_thumb_pattern: 'redstone_door_trap',
  human_human_dispenser_arrow_turret_manual: 'redstone_door_trap',
  human_human_item_frame_secret_stash_cover: 'item_frame_map_wall',
  human_human_ravager_stun_shield_react: 'use_shield_block',
  human_human_skeleton_shield_pitch_aim: 'use_shield_block',
  human_human_hoglin_shield_timed_block: 'use_shield_block',
  human_human_shulker_cover_shield_bullets: 'use_shield_block',
  human_human_ghast_deflect_angry_return: 'use_shield_block',
  human_human_drowned_ranged_trident_kite: 'use_shield_block',
  human_human_blaze_doorframe_snipe: 'bow_snipe',
};

const SPECIAL = {
  human_human_idle_camera_micro_yaw_noise: idleMicroYawNoise,
  human_human_cow_milk_cooldown_throttle_space: milkCowCooldownThrottle,
  human_human_leash_villager_pit_fallback: leashVillagerEthics,
  human_human_parrot_no_chocolate_ever: parrotNoChocolate,
};

const humanPlayHandlers = {};
for (const id of HUMAN_PLAY_TASK_IDS) {
  if (SPECIAL[id]) humanPlayHandlers[id] = SPECIAL[id];
  else if (DELEGATES[id]) humanPlayHandlers[id] = delegate(DELEGATES[id]);
  else humanPlayHandlers[id] = humanPlayStub;
}

module.exports = humanPlayHandlers;
