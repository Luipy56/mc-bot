'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;
const { countItems, hasItem } = require('../lib/inventoryQuery');
const miningSkill = require('./mining');
const smeltingSkill = require('./smelting');
const craftingSkill = require('./crafting');
const {
  sleep, gotoTimeout, GOTO_MS, partial, openFurnaceCookOnce, nearestPassiveForBreed, isLogBlock,
} = require('./extendedPlayerLib');

const FISH_NAMES = ['cod', 'salmon', 'tropical_fish', 'pufferfish'];
const RAW_FOODS = ['beef', 'porkchop', 'chicken', 'mutton', 'rabbit', 'cod', 'salmon', 'potato'];
const FUEL = ['coal', 'charcoal', 'bamboo', 'dried_kelp'];

async function fishForFood(bot, state) {
  if (typeof bot.fish !== 'function') return partial('bot.fish() not available.');
  const rod = bot.inventory.items().find((i) => i.name === 'fishing_rod');
  if (!rod) return partial('Need fishing rod.');
  const water = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 40,
    matching: (b) => b && (b.name === 'water' || b.name === 'flowing_water'),
  });
  if (!water) return partial('No water for fishing.');
  const before = countItems(bot, FISH_NAMES);
  try {
    await bot.equip(rod, 'hand');
    await bot.lookAt(water.position.offset(0.5, 0.5, 0.5), true);
    await Promise.race([bot.fish(), sleep(50000)]);
  } catch (e) {
    return partial(e.message || 'Fishing failed.');
  }
  const after = countItems(bot, FISH_NAMES);
  return {
    success: after > before,
    reason: after > before ? `Caught fish (now ${after}).` : 'No fish caught this cast.',
  };
}

async function breedAnimals(bot, state) {
  const wheat = bot.inventory.items().find((i) => i.name === 'wheat');
  const carrot = bot.inventory.items().find((i) => i.name === 'carrot');
  const food = wheat || carrot;
  if (!food) return partial('Need wheat or carrots to breed farm animals.');
  const a = nearestPassiveForBreed(bot, 14);
  if (!a) return partial('No cow/sheep/mooshroom nearby.');
  try {
    await bot.equip(food, 'hand');
    await gotoTimeout(bot, new GoalGetToBlock(a.position.x, a.position.y, a.position.z), GOTO_MS);
    let r = bot.useOn(a);
    if (r && r.then) await r;
    await sleep(400);
    const b = nearestPassiveForBreed(bot, 14);
    if (b && b.id !== a.id) {
      r = bot.useOn(b);
      if (r && r.then) await r;
    }
  } catch (e) {
    return partial(e.message || 'Breed interact failed.');
  }
  return { success: true, reason: 'Used breed food on nearby animals.' };
}

async function collectEggs(bot, state) {
  const before = countItems(bot, 'egg');
  const start = Date.now();
  while (Date.now() - start < 22000) {
    if (countItems(bot, 'egg') > before) {
      return { success: true, reason: 'Picked up egg(s).' };
    }
    const chicken = bot.nearestEntity((e) => e.name === 'chicken' && e.position.distanceTo(bot.entity.position) < 20);
    if (chicken) {
      try {
        await gotoTimeout(
          bot,
          new GoalGetToBlock(chicken.position.x, chicken.position.y, chicken.position.z),
          Math.min(8000, GOTO_MS)
        );
      } catch (e) { /* ignore */ }
    }
    await sleep(600);
  }
  return {
    success: countItems(bot, 'egg') > before,
    reason: countItems(bot, 'egg') > before ? 'Eggs collected while waiting.' : 'No eggs picked up (stand near chickens).',
  };
}

async function stripLogs(bot, state) {
  const axe = bot.inventory.items().find((i) => i.name.endsWith('_axe'));
  if (!axe) return partial('Need any axe.');
  const log = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 28,
    matching: (b) => b && isLogBlock(b.name),
  });
  if (!log) return partial('No log nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(log.position.x, log.position.y, log.position.z), GOTO_MS);
    await bot.equip(axe, 'hand');
    await bot.activateBlock(log);
  } catch (e) {
    return partial(e.message || 'Strip failed.');
  }
  return { success: true, reason: 'Used axe on log (stripped if supported).' };
}

async function useCampfireCook(bot, state) {
  const cf = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 22,
    matching: (b) => b && (b.name === 'campfire' || b.name === 'soul_campfire'),
  });
  if (!cf) return partial('No campfire nearby.');
  const food = bot.inventory.items().find((i) => RAW_FOODS.includes(i.name));
  if (!food) return partial('Need raw meat or potato.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(cf.position.x, cf.position.y, cf.position.z), GOTO_MS);
    await bot.equip(food, 'hand');
    await bot.activateBlock(cf);
    await sleep(12000);
  } catch (e) {
    return partial(e.message || 'Campfire cook failed.');
  }
  return { success: true, reason: 'Interacted with campfire (cooking if slot free).' };
}

async function useSmoker(bot, state) {
  return openFurnaceCookOnce(
    bot,
    (b) => b && (b.name === 'smoker' || b.name === 'lit_smoker'),
    RAW_FOODS,
    FUEL
  );
}

async function useBlastFurnace(bot, state) {
  return openFurnaceCookOnce(
    bot,
    (b) => b && (b.name === 'blast_furnace' || b.name === 'lit_blast_furnace'),
    ['raw_iron', 'raw_gold', 'iron_ore', 'gold_ore', 'deepslate_iron_ore', 'deepslate_gold_ore', 'copper_ore', 'deepslate_copper_ore'],
    FUEL
  );
}

async function useStonecutter(bot, state) {
  return partial('Stonecutter recipes are version-specific; use crafting table or extend handler.');
}

async function useLoom(bot, state) {
  return partial('Loom UI not automated; open manually.');
}

async function useCartography(bot, state) {
  return partial('Cartography table not automated.');
}

async function useGrindstone(bot, state) {
  const b = bot.findBlock({ point: bot.entity.position, maxDistance: 20, matching: (x) => x.name === 'grindstone' });
  if (!b) return partial('No grindstone nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(b.position.x, b.position.y, b.position.z), GOTO_MS);
    const w = await bot.openBlock(b);
    await sleep(400);
    await bot.closeWindow(w);
  } catch (e) {
    return partial(e.message || 'Grindstone open failed.');
  }
  return { success: true, reason: 'Opened grindstone (place items manually).' };
}

async function useSmithingTable(bot, state) {
  const b = bot.findBlock({ point: bot.entity.position, maxDistance: 20, matching: (x) => x.name === 'smithing_table' });
  if (!b) return partial('No smithing table nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(b.position.x, b.position.y, b.position.z), GOTO_MS);
    const w = await bot.openBlock(b);
    await sleep(300);
    await bot.closeWindow(w);
  } catch (e) {
    return partial(e.message || 'Smithing table failed.');
  }
  return { success: true, reason: 'Opened smithing table (upgrade/trim manually).' };
}

async function useAnvilRepair(bot, state) {
  const b = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 18,
    matching: (x) => x && String(x.name).includes('anvil'),
  });
  if (!b) return partial('No anvil nearby.');
  if (typeof bot.openAnvil !== 'function') return partial('openAnvil not available.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(b.position.x, b.position.y, b.position.z), GOTO_MS);
    const w = await bot.openAnvil(b);
    await sleep(400);
    await bot.closeWindow(w);
  } catch (e) {
    return partial(e.message || 'Anvil open failed.');
  }
  return { success: true, reason: 'Opened anvil (combine/repair manually).' };
}

async function enchantAtTable(bot, state) {
  if (typeof bot.openEnchantmentTable !== 'function') return partial('Enchanting API missing.');
  const b = bot.findBlock({ point: bot.entity.position, maxDistance: 18, matching: (x) => x.name === 'enchanting_table' });
  if (!b) return partial('No enchanting table nearby.');
  const pick = bot.inventory.items().find((i) => i.name.includes('pickaxe') || i.name.includes('sword'));
  const lapis = bot.inventory.items().find((i) => i.name === 'lapis_lazuli');
  if (!pick || !lapis) return partial('Need tool + lapis for enchanting.');
  let w;
  try {
    await gotoTimeout(bot, new GoalGetToBlock(b.position.x, b.position.y, b.position.z), GOTO_MS);
    w = await bot.openEnchantmentTable(b);
    await w.putTargetItem(pick);
    await w.putLapis(lapis);
    await sleep(1200);
    await w.enchant(0);
    await sleep(400);
    await w.takeTargetItem();
  } catch (e) {
    return partial(e.message || 'Enchant failed.');
  } finally {
    try {
      if (w) await bot.closeWindow(w);
    } catch (e2) { /* ignore */ }
  }
  return { success: true, reason: 'Applied cheapest enchant option (slot 0).' };
}

async function brewPotion(bot, state) {
  const b = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 16,
    matching: (x) => x && String(x.name).includes('brewing_stand'),
  });
  if (!b) return partial('No brewing stand nearby (use shortcut_brew if configured).');
  let w;
  try {
    await gotoTimeout(bot, new GoalGetToBlock(b.position.x, b.position.y, b.position.z), GOTO_MS);
    w = await bot.openBlock(b);
    await sleep(500);
  } catch (e) {
    return partial(e.message || 'Brewing stand open failed.');
  } finally {
    try {
      if (w) await bot.closeWindow(w);
    } catch (e2) { /* ignore */ }
  }
  return { success: true, reason: 'Opened brewing stand (finish potions manually).' };
}

async function fillGlassBottlesWater(bot, state) {
  const want = Math.max(1, 3);
  let bottles = bot.inventory.items().find((i) => i.name === 'glass_bottle');
  if (!bottles) return partial('Need glass bottles.');
  const water = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 32,
    matching: (b) => b && (b.name === 'water' || b.name === 'flowing_water'),
  });
  if (!water) return partial('No water.');
  const before = countItems(bot, 'potion') + countItems(bot, 'water_bottle'); // water bottle item name
  try {
    await gotoTimeout(bot, new GoalGetToBlock(water.position.x, water.position.y, water.position.z), GOTO_MS);
    for (let n = 0; n < want; n++) {
      bottles = bot.inventory.items().find((i) => i.name === 'glass_bottle');
      if (!bottles) break;
      await bot.equip(bottles, 'hand');
      await bot.lookAt(water.position.offset(0.5, 0.5, 0.5), true);
      await bot.activateBlock(water);
      await sleep(350);
    }
  } catch (e) {
    return partial(e.message || 'Bottle fill failed.');
  }
  const wb = countItems(bot, 'potion'); // 1.21 might use water_bottle as name
  const wb2 = countItems(bot, 'water_bottle');
  return {
    success: wb + wb2 > 0 || countItems(bot, 'glass_bottle') < 3,
    reason: 'Filled bottles at water (check potion/water_bottle items).',
  };
}

async function collectHoney(bot, state) {
  const bottle = bot.inventory.items().find((i) => i.name === 'glass_bottle');
  if (!bottle) return partial('Need glass bottle.');
  const hive = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 20,
    matching: (b) => b && (b.name === 'beehive' || b.name === 'bee_nest'),
  });
  if (!hive) return partial('No beehive/nest nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(hive.position.x, hive.position.y, hive.position.z), GOTO_MS);
    await bot.equip(bottle, 'hand');
    await bot.activateBlock(hive);
  } catch (e) {
    return partial(e.message || 'Honey bottle failed (may need campfire calm).');
  }
  return { success: hasItem(bot, 'honey_bottle', 1), reason: 'Tried honey bottle on hive.' };
}

async function shearHive(bot, state) {
  const shears = bot.inventory.items().find((i) => i.name === 'shears');
  if (!shears) return partial('Need shears.');
  const hive = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 20,
    matching: (b) => b && (b.name === 'beehive' || b.name === 'bee_nest'),
  });
  if (!hive) return partial('No beehive/nest nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(hive.position.x, hive.position.y, hive.position.z), GOTO_MS);
    await bot.equip(shears, 'hand');
    await bot.activateBlock(hive);
  } catch (e) {
    return partial(e.message || 'Shear hive failed.');
  }
  return { success: countItems(bot, 'honeycomb') >= 1, reason: 'Sheared hive for honeycomb if full.' };
}

async function collectClay(bot, state, params) {
  return miningSkill.run(bot, state, { blockName: 'clay', count: params.count || 16 });
}

async function craftBricks(bot, state) {
  if (hasItem(bot, 'bricks', 1)) return { success: true, reason: 'Already have brick blocks.' };
  const sm = await smeltingSkill.run(bot, state, { outputName: 'brick', minCount: 4, oreNames: ['clay_ball'] });
  if (countItems(bot, 'brick') < 4 && !sm.success) return sm;
  return craftingSkill.run(bot, state, { itemName: 'bricks', count: 1 });
}

async function collectKelp(bot, state, params) {
  return miningSkill.run(bot, state, { blockName: 'kelp', count: params.count || 24 });
}

async function smeltDriedKelp(bot, state) {
  return smeltingSkill.run(bot, state, { outputName: 'dried_kelp', minCount: 8, oreNames: ['kelp'] });
}

async function placeLaddersScaffold(bot, state) {
  const Vec3 = require('vec3');
  const ladder = bot.inventory.items().find((i) => i.name === 'ladder');
  const scaf = bot.inventory.items().find((i) => i.name === 'scaffolding');
  const item = ladder || scaf;
  if (!item) return partial('Need ladder or scaffolding in inventory.');
  const pos = bot.entity.position;
  const p = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const ref = bot.blockAt(p);
  if (!ref) return partial('No footing.');
  try {
    await bot.equip(item, 'hand');
    await bot.placeBlock(ref, new Vec3(0, 1, 0));
  } catch (e) {
    return partial(e.message || 'Place failed.');
  }
  return { success: true, reason: 'Placed one ladder/scaffold above feet.' };
}

module.exports = {
  fish_for_food: fishForFood,
  breed_animals: breedAnimals,
  collect_eggs: collectEggs,
  strip_logs: stripLogs,
  use_campfire_cook: useCampfireCook,
  use_smoker: useSmoker,
  use_blast_furnace: useBlastFurnace,
  use_stonecutter: useStonecutter,
  use_loom: useLoom,
  use_cartography: useCartography,
  use_grindstone: useGrindstone,
  use_smithing_table: useSmithingTable,
  use_anvil_repair: useAnvilRepair,
  enchant_at_table: enchantAtTable,
  brew_potion: brewPotion,
  fill_glass_bottles_water: fillGlassBottlesWater,
  collect_honey: collectHoney,
  shear_hive: shearHive,
  collect_clay: collectClay,
  craft_bricks: craftBricks,
  collect_kelp: collectKelp,
  smelt_dried_kelp: smeltDriedKelp,
  place_ladders_scaffold: placeLaddersScaffold,
};
