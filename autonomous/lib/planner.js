'use strict';

const { isCompleted, setBlackboard } = require('./state');
const { countAllLogs, countAllPlanks } = require('./inventoryQuery');
const { isInNether } = require('./dimension');
const { needsInventoryTrim } = require('./inventorySpace');

const HUNT_WHEN_NO_FOOD_BELOW = parseInt(process.env.HUNT_WHEN_NO_FOOD_BELOW || '11', 10);
const HUNT_STARTER_BELOW = parseInt(process.env.HUNT_STARTER_BELOW || '20', 10);
const START_WOOD_TARGET = parseInt(process.env.START_WOOD_TARGET || '3', 10);
const IGNORE_HUNGER_TASKS = /^(1|true|yes|on)$/i.test(process.env.IGNORE_HUNGER_TASKS || '');
const HOUSE_PLANKS_NEEDED = parseInt(process.env.HOUSE_PLANKS_NEEDED || '112', 10);
const HOUSE_LOG_TARGET = parseInt(
  process.env.HOUSE_LOG_TARGET || String(Math.max(3, Math.ceil(HOUSE_PLANKS_NEEDED / 4) + 2)),
  10
);

const ENABLE_POTATO_FOOD = /^(1|true|yes|on)$/i.test(process.env.ENABLE_POTATO_FOOD || '');
const ENABLE_GEAR_SHORTCUTS = /^(1|true|yes|on)$/i.test(process.env.ENABLE_GEAR_SHORTCUTS || '');
const ENABLE_POSTGAME = /^(1|true|yes|on)$/i.test(process.env.ENABLE_POSTGAME || '');
/** Skip gather + build wooden house to reach iron/Nether faster (default off; keeps tests unchanged). */
const SKIP_WOODEN_HOUSE = /^(1|true|yes|on)$/i.test(process.env.SKIP_WOODEN_HOUSE || '');
/** Extra “normal player” chain: wheat farm, milk, sand/glass, cane/paper, fishing rod (see playerSkillCatalog). */
const ENABLE_EXTRA_PLAYER_SKILLS = /^(1|true|yes|on)$/i.test(process.env.ENABLE_EXTRA_PLAYER_SKILLS || '');

function housePlankName() {
  return (process.env.HOUSE_PLANK_NAME || 'oak_planks').trim() || 'oak_planks';
}

function logNameFromPlanks(plankName) {
  if (plankName === 'bamboo_planks') return 'bamboo_block';
  if (plankName.endsWith('_planks')) return plankName.replace('_planks', '_log');
  return 'oak_log';
}

/** In overworld at Y≤0, raise eat thresholds so the bot snacks before hunger + mob pressure stack (human deepslate habit). */
function deepslateEatThresholdBonus(bot) {
  if (!bot?.entity?.position) return 0;
  const y = bot.entity.position.y;
  if (y == null || !Number.isFinite(y)) return 0;
  if (isInNether(bot)) return 0;
  if (y > 0) return 0;
  return Math.max(0, parseInt(process.env.DEEPSLATE_EAT_THRESHOLD_BONUS || '2', 10));
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
    const envXRaw = process.env.GOTO_TEST_X;
    const hasEnvCoords = envXRaw !== undefined && String(envXRaw).trim() !== '';
    const clearSpawn = !/^(0|false|no|off)$/i.test(process.env.GOTO_TEST_CLEAR_SPAWN ?? '1');
    const protectedClear = parseInt(process.env.PROTECTED_ZONE_CLEAR_DIST || '80', 10);
    const awayDist = parseInt(process.env.GOTO_TEST_AWAY_BLOCKS || '56', 10);
    const dist = Math.max(awayDist, Math.min(protectedClear, 120));

    let gx;
    let gy;
    let gz;
    if (hasEnvCoords) {
      gx = parseInt(envXRaw, 10);
      gy = sp?.y ?? parseInt(process.env.GOTO_TEST_Y || '64', 10);
      gz = parseInt(process.env.GOTO_TEST_Z || '0', 10);
    } else if (sp && clearSpawn) {
      let angle = state.blackboard?.gotoTestAngle;
      if (angle == null || Number.isNaN(angle)) {
        angle = Math.random() * Math.PI * 2;
        setBlackboard(state, 'gotoTestAngle', angle);
      }
      gx = Math.round(sp.x + Math.cos(angle) * dist);
      gy = sp.y;
      gz = Math.round(sp.z + Math.sin(angle) * dist);
    } else {
      gx = sp?.x ?? parseInt(process.env.GOTO_TEST_X || '0', 10);
      gy = sp?.y ?? parseInt(process.env.GOTO_TEST_Y || '64', 10);
      gz = sp?.z ?? parseInt(process.env.GOTO_TEST_Z || '0', 10);
    }
    return {
      taskId: 'goto_test',
      params: { x: gx, y: gy, z: gz },
      reason: hasEnvCoords ? 'Pathfind to configured anchor.' : 'Walk away from spawn (break protection) before gathering.',
    };
  }

  if (!IGNORE_HUNGER_TASKS) {
    const deepBonus = deepslateEatThresholdBonus(bot);
    const eatThreshold = (dangerousNight ? 12 : 10) + deepBonus;
    const minFoodTarget = (dangerousNight ? 14 : 10) + deepBonus;
    if (bot && bot.food < eatThreshold && hasFoodInInventory) {
      let reason = dangerousNight ? 'Food low + danger; eat.' : 'Food low; eat first.';
      if (deepBonus > 0) reason += ' (deepslate: eat earlier).';
      return {
        taskId: 'eat_if_needed',
        params: { minFood: minFoodTarget },
        reason,
      };
    }
  }

  if (!completed('collect_wood')) {
    return {
      taskId: 'collect_wood',
      params: { blockName: 'oak_log', count: START_WOOD_TARGET },
      reason: 'Need starter wood for tools and crafting table.',
    };
  }

  if (dangerousNight && completed('place_bed')) {
    return { taskId: 'sleep_in_bed', params: {}, reason: 'Night + hostiles nearby; sleep to skip danger.' };
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

  if (!IGNORE_HUNGER_TASKS) {
    const eatThreshold = dangerousNight ? 12 : 10;
    const huntNoFoodThreshold = Math.max(eatThreshold, HUNT_WHEN_NO_FOOD_BELOW);
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

  if (!completed('collect_cobblestone')) {
    return {
      taskId: 'collect_cobblestone',
      params: { blockName: 'cobblestone', count: 16 },
      reason: 'Cobblestone for stone tools, pick (3), furnace (8), sword+axe.',
    };
  }
  if (!completed('craft_stone_pick')) {
    return { taskId: 'craft_stone_pick', params: { itemName: 'stone_pickaxe', count: 1 }, reason: 'Stone pickaxe for mining.' };
  }
  if (bot && needsInventoryTrim(bot, 4)) {
    return {
      taskId: 'lighten_inventory',
      params: { minFreeSlots: 5 },
      reason: 'Inventory nearly full; drop junk before more gathering.',
    };
  }
  if (!completed('craft_stone_sword')) {
    return { taskId: 'craft_stone_sword', params: { itemName: 'stone_sword', count: 1 }, reason: 'Stone sword for combat.' };
  }
  if (!completed('craft_stone_axe')) {
    return { taskId: 'craft_stone_axe', params: { itemName: 'stone_axe', count: 1 }, reason: 'Stone axe for wood and fighting.' };
  }
  if (!completed('craft_wood_axe')) {
    return { taskId: 'craft_wood_axe', params: { itemName: 'wooden_axe', count: 1 }, reason: 'Wooden axe backup / faster logs.' };
  }
  if (!completed('collect_more_wood')) {
    return { taskId: 'collect_more_wood', params: { blockName: 'oak_log', count: 16 }, reason: 'More wood for base and sticks.' };
  }
  if (!completed('collect_coal')) {
    return { taskId: 'collect_coal', params: { blockName: 'coal_ore', count: 4 }, reason: 'Coal for torches/furnace.' };
  }
  if (!completed('craft_torch')) {
    return { taskId: 'craft_torch', params: { itemName: 'torch', count: 4 }, reason: 'Craft torches (4× recipe) for caves/night.' };
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
  if (!SKIP_WOODEN_HOUSE) {
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
  }
  if (ENABLE_POTATO_FOOD && !completed('build_potato_farm')) {
    return { taskId: 'build_potato_farm', params: {}, reason: 'Small potato farm for reliable food.' };
  }
  if (ENABLE_POTATO_FOOD && !completed('collect_potatoes')) {
    return { taskId: 'collect_potatoes', params: { count: 16 }, reason: 'Harvest potatoes for smelting.' };
  }
  if (ENABLE_POTATO_FOOD && !completed('smelt_baked_potatoes')) {
    return {
      taskId: 'smelt_baked_potatoes',
      params: { outputName: 'baked_potato', minCount: 12, oreNames: ['potato'] },
      reason: 'Smelt potatoes into baked potatoes.',
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
  if (bot && needsInventoryTrim(bot, 3)) {
    return {
      taskId: 'lighten_inventory',
      params: { minFreeSlots: 5 },
      reason: 'Inventory full before iron mining; make space.',
    };
  }
  if (!completed('collect_iron_ore')) {
    return {
      taskId: 'collect_iron_ore',
      params: { blockName: 'iron_ore', count: 40, countAsNames: ['raw_iron', 'iron_ingot'] },
      reason: 'Iron for pick, shears, sword, armor, bucket, and flint & steel.',
    };
  }
  if (!completed('smelt_iron_ingots')) {
    return {
      taskId: 'smelt_iron_ingots',
      params: { outputName: 'iron_ingot', minCount: 35 },
      reason: 'Smelt raw iron for tools, shears, armor, bucket, and flint & steel.',
    };
  }
  if (!completed('craft_iron_pickaxe')) {
    return { taskId: 'craft_iron_pickaxe', params: { itemName: 'iron_pickaxe', count: 1 }, reason: 'Iron pick for diamonds and obsidian.' };
  }
  if (!completed('craft_shears')) {
    return { taskId: 'craft_shears', params: { itemName: 'shears', count: 1 }, reason: 'Shears to collect wool from sheep.' };
  }
  if (!completed('shear_sheep')) {
    return { taskId: 'shear_sheep', params: { maxDistance: 40, minWool: 1 }, reason: 'Shear a sheep for wool (beds, building).' };
  }
  if (!completed('craft_iron_sword')) {
    return { taskId: 'craft_iron_sword', params: { itemName: 'iron_sword', count: 1 }, reason: 'Iron sword for stronger melee.' };
  }
  if (!completed('craft_iron_armor_set')) {
    return { taskId: 'craft_iron_armor_set', params: {}, reason: 'Craft iron boots → helmet → leggings → chestplate when ingots allow.' };
  }
  if (!completed('equip_iron_kit')) {
    return { taskId: 'equip_iron_kit', params: {}, reason: 'Equip new iron armor and best weapon.' };
  }
  if (!completed('craft_iron_bucket')) {
    return { taskId: 'craft_iron_bucket', params: { itemName: 'bucket', count: 1 }, reason: 'Iron bucket for water (farms, safety).' };
  }
  if (!completed('fill_water_bucket')) {
    return { taskId: 'fill_water_bucket', params: {}, reason: 'Fill bucket from a nearby water source.' };
  }
  if (!completed('place_water_source')) {
    return { taskId: 'place_water_source', params: {}, reason: 'Place infinite water in a ground pit near base.' };
  }
  if (ENABLE_EXTRA_PLAYER_SKILLS) {
    if (!completed('collect_grass_seeds')) {
      return {
        taskId: 'collect_grass_seeds',
        params: { count: 4 },
        reason: 'Break grass for wheat seeds (farming / bread path).',
      };
    }
    if (!completed('craft_stone_hoe')) {
      return { taskId: 'craft_stone_hoe', params: { itemName: 'stone_hoe', count: 1 }, reason: 'Stone hoe to till soil.' };
    }
    if (!completed('till_plant_wheat')) {
      return { taskId: 'till_plant_wheat', params: {}, reason: 'Till dirt near water and plant wheat.' };
    }
    if (!completed('harvest_mature_wheat')) {
      return {
        taskId: 'harvest_mature_wheat',
        params: { count: 3 },
        reason: 'Harvest mature wheat for flour → bread.',
      };
    }
    if (!completed('craft_bread')) {
      return { taskId: 'craft_bread', params: { itemName: 'bread', count: 1 }, reason: 'Craft bread from wheat.' };
    }
    if (!completed('milk_cow')) {
      return { taskId: 'milk_cow', params: {}, reason: 'Milk a cow (empty bucket → milk bucket).' };
    }
    if (!completed('collect_sand')) {
      return {
        taskId: 'collect_sand',
        params: { blockName: 'sand', count: 16 },
        reason: 'Gather sand for glass smelting.',
      };
    }
    if (!completed('smelt_glass')) {
      return {
        taskId: 'smelt_glass',
        params: { outputName: 'glass', minCount: 8, oreNames: ['sand'] },
        reason: 'Smelt sand into glass blocks.',
      };
    }
    if (!completed('collect_sugar_cane')) {
      return {
        taskId: 'collect_sugar_cane',
        params: { blockName: 'sugar_cane', count: 9, countAsNames: ['sugar_cane'] },
        reason: 'Sugar cane for paper.',
      };
    }
    if (!completed('craft_paper')) {
      return { taskId: 'craft_paper', params: { itemName: 'paper', count: 1 }, reason: 'Craft paper (3 cane per batch).' };
    }
    if (!completed('craft_fishing_rod')) {
      return {
        taskId: 'craft_fishing_rod',
        params: { itemName: 'fishing_rod', count: 1 },
        reason: 'Fishing rod for future fish_for_food skill.',
      };
    }
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

  if (ENABLE_GEAR_SHORTCUTS && !completed('shortcut_villager')) {
    return { taskId: 'shortcut_villager', params: {}, reason: 'Optional: reach villager for trades (ENABLE_GEAR_SHORTCUTS).' };
  }
  if (ENABLE_GEAR_SHORTCUTS && !completed('shortcut_enchant')) {
    return { taskId: 'shortcut_enchant', params: {}, reason: 'Optional: use enchanting table when placed nearby.' };
  }
  if (ENABLE_GEAR_SHORTCUTS && !completed('shortcut_brew')) {
    return { taskId: 'shortcut_brew', params: {}, reason: 'Optional: use brewing stand when placed nearby.' };
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
    if (bot && !isInNether(bot)) {
      return { taskId: 'enter_nether', params: {}, reason: 'Need the Nether for blaze rods.' };
    }
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
  if (!completed('prep_end_combat')) {
    return { taskId: 'prep_end_combat', params: {}, reason: 'Craft bow/arrows/shield/golden apple when possible before End.' };
  }
  if (!completed('fill_end_portal')) {
    return { taskId: 'fill_end_portal', params: {}, reason: 'Place eyes of ender in portal frame until it opens.' };
  }
  if (!completed('enter_end')) {
    return { taskId: 'enter_end', params: {}, reason: 'Enter End dimension.' };
  }
  if (!completed('destroy_end_crystals')) {
    return { taskId: 'destroy_end_crystals', params: {}, reason: 'Destroy end crystals on obsidian pillars.' };
  }
  if (!completed('kill_ender_dragon')) {
    return { taskId: 'kill_ender_dragon', params: {}, reason: 'Defeat Ender Dragon and complete the game.' };
  }

  if (ENABLE_POSTGAME && !completed('postgame_end_city')) {
    return { taskId: 'postgame_end_city', params: {}, reason: 'Optional: End gateway / cities (ENABLE_POSTGAME).' };
  }
  if (ENABLE_POSTGAME && !completed('postgame_wither_prep')) {
    return { taskId: 'postgame_wither_prep', params: {}, reason: 'Optional: Wither materials check (ENABLE_POSTGAME).' };
  }

  return { taskId: 'idle', params: {}, reason: 'Game complete (main quest done).' };
}

module.exports = { nextRoadmapTask };
