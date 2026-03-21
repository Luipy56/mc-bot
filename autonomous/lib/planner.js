'use strict';

const { isCompleted } = require('./state');
const { countAllLogs, countAllPlanks } = require('./inventoryQuery');

const HUNT_WHEN_NO_FOOD_BELOW = parseInt(process.env.HUNT_WHEN_NO_FOOD_BELOW || '11', 10);
const HUNT_STARTER_BELOW = parseInt(process.env.HUNT_STARTER_BELOW || '20', 10);
const START_WOOD_TARGET = parseInt(process.env.START_WOOD_TARGET || '3', 10);
const IGNORE_HUNGER_TASKS = /^(1|true|yes|on)$/i.test(process.env.IGNORE_HUNGER_TASKS || '');
const HOUSE_PLANKS_NEEDED = parseInt(process.env.HOUSE_PLANKS_NEEDED || '112', 10);
const HOUSE_LOG_TARGET = parseInt(
  process.env.HOUSE_LOG_TARGET || String(Math.max(3, Math.ceil(HOUSE_PLANKS_NEEDED / 4) + 2)),
  10
);

function housePlankName() {
  return (process.env.HOUSE_PLANK_NAME || 'oak_planks').trim() || 'oak_planks';
}

function logNameFromPlanks(plankName) {
  if (plankName === 'bamboo_planks') return 'bamboo_block';
  if (plankName.endsWith('_planks')) return plankName.replace('_planks', '_log');
  return 'oak_log';
}

/**
 * Roadmap only (no world sync). Call after syncProgressFromInventory + updateSituation.
 */
function nextRoadmapTask(state, bot) {
  if (!state) return { taskId: 'idle', params: {}, reason: 'No state.' };

  const completed = (id) => isCompleted(state, id);
  const hostiles = state.blackboard?.nearHostiles ?? 0;
  const nearPassiveFood = state.blackboard?.nearPassiveFood ?? 0;
  const hasFoodInInventory = Boolean(state.blackboard?.hasFoodInInventory);
  const regionProtected = Boolean(state.blackboard?.regionProtected);
  const logsInInv = bot ? countAllLogs(bot) : 0;
  const planksInInv = bot ? countAllPlanks(bot) : 0;
  const housePlanks = housePlankName();
  const houseLog = logNameFromPlanks(housePlanks);
  const isNight = bot?.time && !bot.time.isDay;
  const dangerousNight = isNight && hostiles >= 2;

  if (!completed('init_structure')) {
    return { taskId: 'init_structure', params: {}, reason: 'Bootstrap.' };
  }
  if (!completed('connect')) {
    return { taskId: 'connect', params: {}, reason: 'Connect and spawn.' };
  }
  if (!completed('goto_test')) {
    const sp = state.blackboard?.spawnPos;
    const gx = sp?.x ?? parseInt(process.env.GOTO_TEST_X || '0', 10);
    const gy = sp?.y ?? parseInt(process.env.GOTO_TEST_Y || '64', 10);
    const gz = sp?.z ?? parseInt(process.env.GOTO_TEST_Z || '0', 10);
    return { taskId: 'goto_test', params: { x: gx, y: gy, z: gz }, reason: 'Pathfind to spawn / anchor point.' };
  }

  if (!IGNORE_HUNGER_TASKS) {
    const eatThreshold = dangerousNight ? 12 : 10;
    const huntNoFoodThreshold = Math.max(eatThreshold, HUNT_WHEN_NO_FOOD_BELOW);
    if (bot && bot.food < eatThreshold && hasFoodInInventory) {
      return {
        taskId: 'eat_if_needed',
        params: { minFood: dangerousNight ? 14 : 10 },
        reason: dangerousNight ? 'Food low + danger; eat.' : 'Food low; eat first.',
      };
    }
    if (bot && bot.food < huntNoFoodThreshold && !hasFoodInInventory && nearPassiveFood >= 1) {
      return {
        taskId: 'hunt_food',
        params: { maxDistance: 34, minMeat: 1, eatBelow: 20 },
        reason: 'Food is low and inventory has no edible items; hunt passive mobs for meat.',
      };
    }
    if (bot && bot.food < huntNoFoodThreshold && !hasFoodInInventory && nearPassiveFood === 0) {
      return {
        taskId: 'explore_nearby',
        params: { forTask: 'hunt_food' },
        reason: 'No food and no passive mobs loaded; explore to find animals.',
      };
    }
    if (!completed('hunt_food') && bot && bot.food <= HUNT_STARTER_BELOW && nearPassiveFood >= 1) {
      return {
        taskId: 'hunt_food',
        params: { maxDistance: 30, minMeat: 1, eatBelow: 20 },
        reason: 'Nearby passive mobs detected; secure starter food like a real player.',
      };
    }
  }

  if (dangerousNight && completed('place_bed')) {
    return { taskId: 'sleep_in_bed', params: {}, reason: 'Night + hostiles nearby; sleep to skip danger.' };
  }

  if (!completed('collect_wood')) {
    return { taskId: 'collect_wood', params: { blockName: 'oak_log', count: START_WOOD_TARGET }, reason: 'Need starter wood for tools and crafting table.' };
  }
  if (!completed('craft_planks')) {
    return { taskId: 'craft_planks', params: { itemName: 'oak_planks', count: 4 }, reason: 'Planks from logs.' };
  }
  if (!completed('craft_sticks')) {
    return { taskId: 'craft_sticks', params: { itemName: 'stick', count: 4 }, reason: 'Sticks for tools and table.' };
  }
  if (!completed('craft_crafting_table')) {
    return { taskId: 'craft_crafting_table', params: { itemName: 'crafting_table', count: 1 }, reason: 'Crafting table for 3x3.' };
  }
  if (!completed('place_crafting_table') && regionProtected) {
    return {
      taskId: 'explore_nearby',
      params: { forTask: 'place_crafting_table' },
      reason: 'Protected area blocks placement; move farther before placing crafting table.',
    };
  }
  if (!completed('place_crafting_table')) {
    return { taskId: 'place_crafting_table', params: { blockName: 'crafting_table' }, reason: 'Place table to unlock 3x3 recipes.' };
  }
  if (!completed('craft_wood_pick')) {
    const potentialPlanks = planksInInv + (logsInInv * 4);
    if (potentialPlanks < 5) {
      const needLogs = Math.max(START_WOOD_TARGET, 3);
      return { taskId: 'collect_wood', params: { blockName: 'oak_log', count: needLogs }, reason: 'Need a bit more wood to craft sticks + wooden pickaxe.' };
    }
    return { taskId: 'craft_wood_pick', params: { itemName: 'wooden_pickaxe', count: 1 }, reason: 'Wooden pickaxe needed to mine stone into cobblestone.' };
  }
  if (!completed('collect_cobblestone')) {
    return { taskId: 'collect_cobblestone', params: { blockName: 'cobblestone', count: 4 }, reason: 'Cobblestone for stone pick.' };
  }
  if (!completed('craft_stone_pick')) {
    return { taskId: 'craft_stone_pick', params: { itemName: 'stone_pickaxe', count: 1 }, reason: 'Stone pickaxe for mining.' };
  }
  if (!completed('collect_more_wood')) {
    return { taskId: 'collect_more_wood', params: { blockName: 'oak_log', count: 16 }, reason: 'More wood for base and sticks.' };
  }
  if (!completed('collect_coal')) {
    return { taskId: 'collect_coal', params: { blockName: 'coal_ore', count: 4 }, reason: 'Coal for torches/furnace.' };
  }
  if (!completed('craft_chest')) {
    return { taskId: 'craft_chest', params: { itemName: 'chest', count: 1 }, reason: 'Chest for storage.' };
  }
  if (!completed('craft_furnace')) {
    return { taskId: 'craft_furnace', params: { itemName: 'furnace', count: 1 }, reason: 'Furnace for smelting.' };
  }
  if (!completed('craft_bed')) {
    return { taskId: 'craft_bed', params: { itemName: 'bed', count: 1 }, reason: 'Bed for spawn point.' };
  }
  if (!completed('place_bed')) {
    return { taskId: 'place_bed', params: { blockName: 'bed' }, reason: 'Place bed to set spawn.' };
  }
  if (!completed('place_chest')) {
    return { taskId: 'place_chest', params: { blockName: 'chest' }, reason: 'Place chest for storage.' };
  }
  if (!completed('collect_wood_for_house')) {
    return {
      taskId: 'collect_wood_for_house',
      params: { blockName: houseLog, count: HOUSE_LOG_TARGET, countAsNames: [houseLog], exactName: houseLog },
      reason: `Gather ${houseLog} to craft ${housePlanks} for wooden house (~${HOUSE_PLANKS_NEEDED} planks).`,
    };
  }
  if (!completed('craft_house_planks')) {
    return {
      taskId: 'craft_house_planks',
      params: { plankName: housePlanks, strict: true, minPlanks: HOUSE_PLANKS_NEEDED },
      reason: `Craft ${housePlanks} for wooden house shell.`,
    };
  }
  if (!completed('build_wooden_house') && regionProtected) {
    return {
      taskId: 'explore_nearby',
      params: { forTask: 'build_wooden_house' },
      reason: 'Protected area blocks building; move farther before house construction.',
    };
  }
  if (!completed('build_wooden_house')) {
    return {
      taskId: 'build_wooden_house',
      params: { plankName: housePlanks, minPlanks: HOUSE_PLANKS_NEEDED },
      reason: `Build wooden house (floor, walls, roof) using ${housePlanks}.`,
    };
  }
  if (bot && bot.time && !bot.time.isDay && (bot.time.timeOfDay ?? 0) >= 12500) {
    return { taskId: 'sleep_in_bed', params: {}, reason: 'Night; sleep in bed.' };
  }
  if (!completed('equip_armor')) {
    return { taskId: 'equip_armor', params: {}, reason: 'Equip best armor from inventory.' };
  }
  if (!completed('equip_weapon')) {
    return { taskId: 'equip_weapon', params: {}, reason: 'Equip best weapon before combat phases.' };
  }
  if (!completed('kill_enemy') && hostiles > 0) {
    return { taskId: 'kill_enemy', params: {}, reason: 'Hostile mob nearby; secure area and gain loot/XP.' };
  }

  if (!completed('place_furnace')) {
    return { taskId: 'place_furnace', params: { blockName: 'furnace' }, reason: 'Place furnace for smelting iron.' };
  }
  if (!completed('collect_iron_ore')) {
    return { taskId: 'collect_iron_ore', params: { blockName: 'iron_ore', count: 12, countAsNames: ['raw_iron', 'iron_ingot'] }, reason: 'Iron for pickaxe and flint & steel.' };
  }
  if (!completed('smelt_iron_ingots')) {
    return { taskId: 'smelt_iron_ingots', params: { outputName: 'iron_ingot', minCount: 8 }, reason: 'Smelt raw iron to ingots.' };
  }
  if (!completed('craft_iron_pickaxe')) {
    return { taskId: 'craft_iron_pickaxe', params: { itemName: 'iron_pickaxe', count: 1 }, reason: 'Iron pick for diamonds and obsidian.' };
  }
  if (!completed('craft_stone_shovel')) {
    return { taskId: 'craft_stone_shovel', params: { itemName: 'stone_shovel', count: 1 }, reason: 'Shovel for gravel → flint.' };
  }
  if (!completed('collect_gravel_for_flint')) {
    return { taskId: 'collect_gravel_for_flint', params: { blockName: 'gravel', count: 2, countAsNames: ['flint'] }, reason: 'Gravel for flint (portal ignition).' };
  }
  if (!completed('craft_flint_and_steel')) {
    return { taskId: 'craft_flint_and_steel', params: { itemName: 'flint_and_steel', count: 1 }, reason: 'Light Nether portal.' };
  }
  if (!completed('collect_diamond_ore')) {
    return {
      taskId: 'collect_diamond_ore',
      params: { blockName: 'diamond_ore', count: 3 },
      reason: 'Diamonds in caves / deepslate (descend if needed); iron pick+.',
    };
  }
  if (!completed('craft_diamond_pickaxe')) {
    return { taskId: 'craft_diamond_pickaxe', params: { itemName: 'diamond_pickaxe', count: 1 }, reason: 'Diamond pick to mine obsidian.' };
  }

  if (!completed('collect_obsidian')) {
    return { taskId: 'collect_obsidian', params: { blockName: 'obsidian', count: 10 }, reason: 'Obsidian for Nether portal.' };
  }
  if (!completed('build_nether_portal')) {
    return { taskId: 'build_nether_portal', params: {}, reason: 'Build and light Nether portal.' };
  }
  if (!completed('enter_nether')) {
    return { taskId: 'enter_nether', params: {}, reason: 'Enter Nether dimension.' };
  }
  if (!completed('collect_blaze_rods')) {
    return { taskId: 'collect_blaze_rods', params: { count: 6 }, reason: 'Blaze rods for blaze powder.' };
  }
  if (!completed('collect_ender_pearls')) {
    return { taskId: 'collect_ender_pearls', params: { count: 12 }, reason: 'Ender pearls for eyes of ender.' };
  }
  if (!completed('craft_blaze_powder')) {
    return { taskId: 'craft_blaze_powder', params: { itemName: 'blaze_powder', count: 12 }, reason: 'Blaze powder for eyes of ender.' };
  }

  if (!completed('craft_eyes_of_ender')) {
    return { taskId: 'craft_eyes_of_ender', params: { count: 12 }, reason: 'Craft eyes of ender.' };
  }
  if (!completed('find_stronghold')) {
    return { taskId: 'find_stronghold', params: {}, reason: 'Locate stronghold with eyes.' };
  }
  if (!completed('enter_end')) {
    return { taskId: 'enter_end', params: {}, reason: 'Enter End dimension.' };
  }
  if (!completed('kill_ender_dragon')) {
    return { taskId: 'kill_ender_dragon', params: {}, reason: 'Defeat Ender Dragon and complete the game.' };
  }

  return { taskId: 'idle', params: {}, reason: 'Game complete (Ender Dragon defeated).' };
}

module.exports = { nextRoadmapTask };
