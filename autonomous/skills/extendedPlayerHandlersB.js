'use strict';

const Vec3 = require('vec3');
const { GoalGetToBlock, GoalFollow } = require('mineflayer-pathfinder').goals;
const { countItems, hasItem } = require('../lib/inventoryQuery');
const miningSkill = require('./mining');
const craftingSkill = require('./crafting');
const { sleep, gotoTimeout, GOTO_MS, partial } = require('./extendedPlayerLib');

async function rideBoat(bot, state) {
  const boat = bot.nearestEntity((e) => e.name === 'boat' || e.name === 'chest_boat' || (e.name && e.name.includes('boat')));
  if (!boat) return partial('No boat entity nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(boat.position.x, boat.position.y, boat.position.z), GOTO_MS);
    await bot.useOn(boat);
  } catch (e) {
    return partial(e.message || 'Could not mount boat.');
  }
  return { success: true, reason: 'Interacted with boat (mount if close).' };
}

async function rideMinecart(bot, state) {
  const cart = bot.nearestEntity((e) => e.name === 'minecart' || e.name === 'chest_minecart' || e.name === 'furnace_minecart');
  if (!cart) return partial('No minecart nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(cart.position.x, cart.position.y, cart.position.z), GOTO_MS);
    await bot.useOn(cart);
  } catch (e) {
    return partial(e.message || 'Minecart mount failed.');
  }
  return { success: true, reason: 'Interacted with minecart.' };
}

async function useElytra(bot, state) {
  const elytra = bot.inventory.items().find((i) => i.name === 'elytra');
  if (!elytra) return partial('No elytra in inventory.');
  try {
    await bot.equip(elytra, 'torso');
  } catch (e) {
    return partial(e.message || 'Equip elytra failed.');
  }
  return { success: true, reason: 'Equipped elytra on chest slot.' };
}

async function throwPearlEscape(bot, state) {
  const pearl = bot.inventory.items().find((i) => i.name === 'ender_pearl');
  if (!pearl) return partial('No ender pearl.');
  try {
    await bot.equip(pearl, 'hand');
    await bot.activateItem();
    await sleep(800);
  } catch (e) {
    return partial(e.message || 'Pearl throw failed.');
  }
  return { success: true, reason: 'Threw ender pearl.' };
}

async function placeBlocksFill(bot, state) {
  const torch = bot.inventory.items().find((i) => i.name === 'torch');
  const cobble = bot.inventory.items().find((i) => i.name === 'cobblestone');
  const item = torch || cobble;
  if (!item) return partial('Need torch or cobble for simple fill.');
  const pos = bot.entity.position;
  const fp = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const ref = bot.blockAt(fp.offset(1, 0, 0));
  if (!ref) return partial('No adjacent block.');
  try {
    await bot.equip(item, 'hand');
    await bot.placeBlock(ref, new Vec3(1, 0, 0));
  } catch (e) {
    return partial(e.message || 'Place fill failed.');
  }
  return { success: true, reason: 'Placed one block beside you (+X).' };
}

async function flattenWithShovel(bot, state) {
  const shovel = bot.inventory.items().find((i) => i.name.endsWith('_shovel'));
  if (!shovel) return partial('Need shovel.');
  const pos = bot.entity.position;
  const p = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  let dug = 0;
  try {
    await bot.equip(shovel, 'hand');
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const b = bot.blockAt(p.offset(dx, 0, dz));
        if (b && (b.name === 'grass_block' || b.name === 'dirt' || b.name === 'podzol')) {
          try {
            await bot.dig(b);
            dug++;
            await sleep(200);
          } catch (e) { /* ignore */ }
        }
      }
    }
  } catch (e) {
    return partial(e.message || 'Flatten dig failed.');
  }
  return { success: dug > 0, reason: `Flattened ${dug} surface blocks.` };
}

async function igniteTnt(bot, state) {
  const fs = bot.inventory.items().find((i) => i.name === 'flint_and_steel');
  if (!fs) return partial('Need flint and steel.');
  const tnt = bot.findBlock({ point: bot.entity.position, maxDistance: 10, matching: (b) => b.name === 'tnt' });
  if (!tnt) return partial('No TNT nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(tnt.position.x, tnt.position.y, tnt.position.z), 12000);
    await bot.equip(fs, 'hand');
    await bot.activateBlock(tnt);
  } catch (e) {
    return partial(e.message || 'Ignite failed.');
  }
  return { success: true, reason: 'Used flint & steel on TNT.' };
}

async function useShieldBlock(bot, state) {
  const sh = bot.inventory.items().find((i) => i.name === 'shield');
  if (!sh) return partial('Need shield.');
  try {
    await bot.equip(sh, 'off-hand');
    bot.setControlState('sneak', true);
    await sleep(2000);
    bot.setControlState('sneak', false);
  } catch (e) {
    return partial(e.message || 'Shield equip failed.');
  }
  return { success: true, reason: 'Raised shield (off-hand + sneak briefly).' };
}

async function bowSnipe(bot, state) {
  const bow = bot.inventory.items().find((i) => i.name === 'bow');
  if (!bow) return partial('Need bow.');
  const target = bot.nearestEntity((e) => {
    if (!e.name) return false;
    return ['zombie', 'skeleton', 'spider', 'creeper'].includes(e.name)
      && e.position.distanceTo(bot.entity.position) < 24;
  });
  if (!target) return partial('No close hostile for bow shot.');
  try {
    await bot.equip(bow, 'hand');
    await bot.lookAt(target.position.offset(0, 1.2, 0), true);
    bot.activateItem();
    await sleep(900);
    bot.deactivateItem();
  } catch (e) {
    return partial(e.message || 'Bow shot failed.');
  }
  return { success: true, reason: 'Loosed one bow shot toward hostile.' };
}

async function splashPotionCombat(bot, state) {
  const splash = bot.inventory.items().find((i) => String(i.name).includes('splash_potion'));
  if (!splash) return partial('No splash potion in inventory.');
  try {
    await bot.equip(splash, 'hand');
    await bot.activateItem();
    await sleep(400);
  } catch (e) {
    return partial(e.message || 'Splash throw failed.');
  }
  return { success: true, reason: 'Threw splash potion.' };
}

async function eatGoldenApple(bot, state) {
  const g = bot.inventory.items().find((i) => i.name === 'golden_apple' || i.name === 'enchanted_golden_apple');
  if (!g) return partial('No golden apple.');
  try {
    await bot.equip(g, 'hand');
    await bot.consume();
  } catch (e) {
    return partial(e.message || 'Eat failed.');
  }
  return { success: true, reason: 'Ate golden apple.' };
}

async function useTotem(bot, state) {
  const t = bot.inventory.items().find((i) => i.name === 'totem_of_undying');
  if (!t) return partial('No totem.');
  try {
    await bot.equip(t, 'off-hand');
  } catch (e) {
    return partial(e.message || 'Totem off-hand failed.');
  }
  return { success: true, reason: 'Moved totem to off-hand.' };
}

async function chorusFruitEscape(bot, state) {
  const c = bot.inventory.items().find((i) => i.name === 'chorus_fruit');
  if (!c) return partial('No chorus fruit.');
  try {
    await bot.equip(c, 'hand');
    await bot.consume();
  } catch (e) {
    return partial(e.message || 'Chorus eat failed.');
  }
  return { success: true, reason: 'Ate chorus fruit (random TP).' };
}

async function respawnAnchorNether(bot, state) {
  return partial('Respawn anchor charging is dangerous to automate; do manually in Nether base.');
}

async function barterPiglin(bot, state) {
  const gold = bot.inventory.items().find((i) => i.name === 'gold_ingot');
  if (!gold) return partial('Need gold ingot.');
  const piglin = bot.nearestEntity((e) => e.name === 'piglin' || e.name === 'piglin_brute');
  if (!piglin) return partial('No piglin nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(piglin.position.x, piglin.position.y, piglin.position.z), GOTO_MS);
    await bot.toss(gold.type, gold.metadata, 1);
    await sleep(3500);
  } catch (e) {
    return partial(e.message || 'Barter toss failed.');
  }
  return { success: true, reason: 'Tossed gold near piglin (wait for trade item).' };
}

async function useComposter(bot, state) {
  const comp = bot.findBlock({ point: bot.entity.position, maxDistance: 18, matching: (b) => b.name === 'composter' });
  if (!comp) return partial('No composter nearby.');
  const feed = bot.inventory.items().find((i) =>
    ['wheat_seeds', 'beetroot_seeds', 'melon_seeds', 'pumpkin_seeds', 'sweet_berries'].includes(i.name));
  if (!feed) return partial('Need seeds/berries for composter.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(comp.position.x, comp.position.y, comp.position.z), GOTO_MS);
    for (let i = 0; i < 14; i++) {
      const f = bot.inventory.items().find((x) => feed.name === x.name);
      if (!f) break;
      await bot.equip(f, 'hand');
      await bot.activateBlock(comp);
      await sleep(180);
    }
  } catch (e) {
    return partial(e.message || 'Composter failed.');
  }
  return { success: true, reason: 'Fed composter (bonemeal may pop out).' };
}

async function boneMealCrops(bot, state) {
  const meal = bot.inventory.items().find((i) => i.name === 'bone_meal');
  if (!meal) return partial('Need bone meal.');
  const crop = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 18,
    matching: (b) => b && (b.name === 'wheat' || b.name === 'carrots' || b.name === 'potatoes' || b.name === 'short_grass'),
  });
  if (!crop) return partial('No crop/grass to bonemeal.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(crop.position.x, crop.position.y, crop.position.z), GOTO_MS);
    await bot.equip(meal, 'hand');
    await bot.activateBlock(crop);
  } catch (e) {
    return partial(e.message || 'Bonemeal failed.');
  }
  return { success: true, reason: 'Used bone meal on block.' };
}

async function carvePumpkin(bot, state) {
  const shears = bot.inventory.items().find((i) => i.name === 'shears');
  if (!shears) return partial('Need shears.');
  const pk = bot.findBlock({ point: bot.entity.position, maxDistance: 18, matching: (b) => b.name === 'pumpkin' });
  if (!pk) return partial('No pumpkin nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(pk.position.x, pk.position.y, pk.position.z), GOTO_MS);
    await bot.equip(shears, 'hand');
    await bot.activateBlock(pk);
  } catch (e) {
    return partial(e.message || 'Carve failed.');
  }
  return { success: true, reason: 'Carved pumpkin with shears.' };
}

async function dyeWool(bot, state) {
  return partial('Shapeless dye+wool crafting not automated; use crafting table manually.');
}

async function renameNameTag(bot, state) {
  return partial('Name tag rename needs anvil text channel; use_anvil_repair + manual name.');
}

async function leadMob(bot, state) {
  const lead = bot.inventory.items().find((i) => i.name === 'lead');
  if (!lead) return partial('Need lead.');
  const mob = bot.nearestEntity((e) => ['cow', 'sheep', 'pig', 'chicken', 'horse', 'donkey', 'wolf'].includes(e.name));
  if (!mob) return partial('No leashable mob nearby.');
  try {
    await bot.equip(lead, 'hand');
    let r = bot.useOn(mob);
    if (r && r.then) await r;
  } catch (e) {
    return partial(e.message || 'Lead failed.');
  }
  return { success: true, reason: 'Used lead on mob.' };
}

async function tradeRotateStock(bot, state) {
  return partial('Villager restock: sleep + workstation access; use shortcut_villager.');
}

async function cureZombieVillager(bot, state) {
  return partial('Curing needs splash weakness + golden apple timing; not automated.');
}

async function raidFarm(bot, state) {
  return partial('Raid farming is world-specific; not safe to auto-start.');
}

async function ironGolemGuard(bot, state) {
  return partial('Iron golem placement pattern not implemented (4 iron T + pumpkin).');
}

async function snowGolemFarm(bot, state) {
  return partial('Snow golem vertical stack not implemented.');
}

async function collectBamboo(bot, state, params) {
  return miningSkill.run(bot, state, { blockName: 'bamboo', count: params.count || 16 });
}

async function craftScaffolding(bot, state) {
  return craftingSkill.run(bot, state, { itemName: 'scaffolding', count: 8 });
}

async function useSpyglass(bot, state) {
  const sp = bot.inventory.items().find((i) => i.name === 'spyglass');
  if (!sp) return partial('No spyglass.');
  try {
    await bot.equip(sp, 'hand');
    await bot.activateItem();
    await sleep(1500);
    bot.deactivateItem();
  } catch (e) {
    return partial(e.message || 'Spyglass failed.');
  }
  return { success: true, reason: 'Looked through spyglass briefly.' };
}

async function brushArchaeology(bot, state) {
  const brush = bot.inventory.items().find((i) => i.name === 'brush');
  if (!brush) return partial('Need brush.');
  const sus = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 12,
    matching: (b) => b && (String(b.name).includes('suspicious_sand') || String(b.name).includes('suspicious_gravel')),
  });
  if (!sus) return partial('No suspicious sand/gravel nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(sus.position.x, sus.position.y, sus.position.z), GOTO_MS);
    await bot.equip(brush, 'hand');
    await bot.activateBlock(sus);
    await sleep(1200);
  } catch (e) {
    return partial(e.message || 'Brush failed.');
  }
  return { success: true, reason: 'Brushed suspicious block.' };
}

async function trimArmorSmithing(bot, state) {
  return partial('Armor trims need template + materials in smithing UI.');
}

async function wolfArmorEquip(bot, state) {
  return partial('Wolf armor equip on tamed wolf not automated.');
}

async function placeLightLevelSafe(bot, state) {
  const torch = bot.inventory.items().find((i) => i.name === 'torch');
  if (!torch) return partial('Need torches.');
  const pos = bot.entity.position;
  const p = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const spots = [p.offset(2, 0, 0), p.offset(-2, 0, 0), p.offset(0, 0, 2), p.offset(0, 0, -2)];
  let placed = 0;
  try {
    await bot.equip(torch, 'hand');
    for (const s of spots) {
      const under = bot.blockAt(s.offset(0, -1, 0));
      const air = bot.blockAt(s);
      if (under && under.boundingBox !== 'empty' && air && air.name === 'air') {
        try {
          await bot.placeBlock(under, new Vec3(0, 1, 0));
          placed++;
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    return partial(e.message || 'Torch place failed.');
  }
  return { success: placed > 0, reason: `Placed ${placed} perimeter torches.` };
}

async function bucketLavaSafe(bot, state) {
  const bucket = bot.inventory.items().find((i) => i.name === 'bucket');
  if (!bucket) return partial('Need empty bucket.');
  const lava = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 18,
    matching: (b) => b && (b.name === 'lava' || b.name === 'flowing_lava'),
  });
  if (!lava) return partial('No lava nearby.');
  if (lava.position.y < bot.entity.position.y - 6) return partial('Lava too far below (unsafe).');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(lava.position.x, lava.position.y, lava.position.z), GOTO_MS);
    await bot.equip(bucket, 'hand');
    await bot.lookAt(lava.position.offset(0.5, 0.5, 0.5), true);
    await bot.activateBlock(lava, new Vec3(0, 1, 0));
  } catch (e) {
    return partial(e.message || 'Lava bucket failed.');
  }
  return { success: hasItem(bot, 'lava_bucket', 1), reason: 'Attempted lava bucket (stand on solid ground).' };
}

async function createNetheriteGear(bot, state) {
  return partial('Netherite upgrade needs smithing template + ingot; use smithing table manually.');
}

async function fireworkRocketBoost(bot, state) {
  const rocket = bot.inventory.items().find((i) => i.name === 'firework_rocket');
  if (!rocket) return partial('Need firework rocket.');
  try {
    await bot.equip(rocket, 'hand');
    await bot.activateItem();
    await sleep(400);
  } catch (e) {
    return partial(e.message || 'Rocket use failed.');
  }
  return { success: true, reason: 'Used firework rocket (elytra boost if gliding).' };
}

async function bookAndQuill(bot, state) {
  return craftingSkill.run(bot, state, { itemName: 'writable_book', count: 1 });
}

async function lecternRead(bot, state) {
  const lec = bot.findBlock({ point: bot.entity.position, maxDistance: 8, matching: (b) => b.name === 'lectern' });
  if (!lec) return partial('No lectern nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(lec.position.x, lec.position.y, lec.position.z), GOTO_MS);
    const w = await bot.openBlock(lec);
    await sleep(300);
    await bot.closeWindow(w);
  } catch (e) {
    return partial(e.message || 'Lectern failed.');
  }
  return { success: true, reason: 'Opened lectern UI.' };
}

async function armorStandPose(bot, state) {
  const stand = bot.inventory.items().find((i) => i.name === 'armor_stand');
  if (!stand) return partial('Need armor stand item.');
  const pos = bot.entity.position;
  const fp = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const ref = bot.blockAt(fp.offset(1, 0, 0));
  if (!ref) return partial('No adjacent block.');
  try {
    await bot.equip(stand, 'hand');
    await bot.placeBlock(ref, new Vec3(1, 0, 0));
  } catch (e) {
    return partial(e.message || 'Armor stand place failed.');
  }
  return { success: true, reason: 'Placed armor stand.' };
}

async function itemFrameMapWall(bot, state) {
  return partial('Item frame + map placement needs facing; not automated.');
}

async function redstoneDoorTrap(bot, state) {
  return partial('Redstone wiring not automated.');
}

async function hopperSort(bot, state) {
  return partial('Hopper sorting not automated.');
}

async function autoFurnaceFuelLine(bot, state) {
  return partial('Hopper furnace arrays not automated.');
}

async function xpOrbCollectMend(bot, state) {
  return partial('Stand near XP orbs after smelting/kills; mending applies automatically when holding tool.');
}

async function sneakBridgeVoid(bot, state) {
  const block = bot.inventory.items().find((i) => i.name === 'cobblestone' || i.name === 'stone');
  if (!block) return partial('Need solid blocks.');
  const pos = bot.entity.position;
  const fp = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const ref = bot.blockAt(fp.offset(1, -1, 0));
  if (!ref) return partial('No reference under forward bridge.');
  try {
    bot.setControlState('sneak', true);
    await bot.equip(block, 'hand');
    await bot.placeBlock(ref, new Vec3(1, 0, 0));
    bot.setControlState('sneak', false);
  } catch (e) {
    bot.setControlState('sneak', false);
    return partial(e.message || 'Sneak bridge failed.');
  }
  return { success: true, reason: 'Placed one forward block while sneaking.' };
}

async function pillarUpJump(bot, state) {
  const block = bot.inventory.items().find((i) => i.name === 'cobblestone' || i.name === 'dirt');
  if (!block) return partial('Need pillar blocks.');
  const pos = bot.entity.position;
  const fp = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const under = bot.blockAt(fp.offset(0, -1, 0));
  if (!under) return partial('No block under feet.');
  try {
    await bot.equip(block, 'hand');
    bot.setControlState('jump', true);
    await sleep(120);
    bot.setControlState('jump', false);
    await bot.placeBlock(under, new Vec3(0, 1, 0));
  } catch (e) {
    return partial(e.message || 'Pillar failed.');
  }
  return { success: true, reason: 'Jump-placed one block under (best-effort).' };
}

async function waterBucketMlg(bot, state) {
  const wb = bot.inventory.items().find((i) => i.name === 'water_bucket');
  if (!wb) return partial('Need water bucket.');
  try {
    await bot.equip(wb, 'hand');
    const pos = bot.entity.position;
    const fp = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    const p = fp.offset(0, -1, 0);
    const b = bot.blockAt(p);
    if (b) await bot.placeBlock(b, new Vec3(0, 1, 0));
  } catch (e) {
    return partial(e.message || 'Water MLG failed.');
  }
  return { success: true, reason: 'Placed water at feet (MLG practice).' };
}

async function eatDriedKelpFast(bot, state) {
  const k = bot.inventory.items().find((i) => i.name === 'dried_kelp');
  if (!k) return partial('No dried kelp.');
  try {
    await bot.equip(k, 'hand');
    await bot.consume();
  } catch (e) {
    return partial(e.message || 'Eat kelp failed.');
  }
  return { success: true, reason: 'Ate dried kelp.' };
}

async function organizeChestTabs(bot, state) {
  const chestBlock = bot.findBlock({
    point: bot.entity.position,
    maxDistance: 10,
    matching: (b) => b && (b.name === 'chest' || b.name === 'trapped_chest' || b.name === 'barrel'),
  });
  if (!chestBlock) return partial('No chest/barrel nearby.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z), GOTO_MS);
    const chest = await bot.openChest(chestBlock);
    const junk = ['cobblestone', 'dirt', 'andesite', 'diorite', 'granite', 'rotten_flesh'];
    for (const name of junk) {
      const it = bot.inventory.items().find((i) => i.name === name && i.count > 48);
      if (!it) continue;
      await chest.deposit(it.type, it.metadata ?? null, Math.min(32, it.count - 32));
    }
    await bot.closeWindow(chest);
  } catch (e) {
    return partial(e.message || 'Chest organize failed.');
  }
  return { success: true, reason: 'Deposited excess stone/dirt into nearby storage.' };
}

async function bundleItems(bot, state) {
  const bundle = bot.inventory.items().find((i) => String(i.name).includes('bundle'));
  if (!bundle) return partial('No bundle item.');
  return partial('Bundle insert/remove needs slot UI; equip bundle manually.');
}

async function shulkerBoxKit(bot, state) {
  const box = bot.inventory.items().find((i) => String(i.name).endsWith('shulker_box'));
  if (!box) return partial('No shulker box item.');
  return partial('Place shulker and use as mini-chest manually.');
}

async function collectNetherrack(bot, state, params) {
  return miningSkill.run(bot, state, { blockName: 'netherrack', count: params.count || 32 });
}

async function consumeCookedMeat(bot, state) {
  const names = ['cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_rabbit', 'cooked_cod', 'cooked_salmon', 'baked_potato'];
  const food = bot.inventory.items().find((i) => names.includes(i.name));
  if (!food) return partial('No cooked food in inventory.');
  try {
    await bot.equip(food, 'hand');
    await bot.consume();
  } catch (e) {
    return partial(e.message || 'Consume failed.');
  }
  return { success: true, reason: 'Ate cooked food.' };
}

async function craftLantern(bot, state) {
  return craftingSkill.run(bot, state, { itemName: 'lantern', count: 1 });
}

async function craftIronShovel(bot, state) {
  return craftingSkill.run(bot, state, { itemName: 'iron_shovel', count: 1 });
}

async function craftArrowBatch(bot, state) {
  return craftingSkill.run(bot, state, { itemName: 'arrow', count: 4 });
}

async function collectFlintExtra(bot, state, params) {
  return miningSkill.run(bot, state, { blockName: 'gravel', count: params.count || 8, countAsNames: ['flint', 'gravel'] });
}

async function placeTorchHostileCave(bot, state) {
  const torch = bot.inventory.items().find((i) => i.name === 'torch');
  if (!torch) return partial('Need torches.');
  if (bot.time?.isDay !== false && (bot.time?.timeOfDay ?? 6000) < 13000) {
    return { success: true, reason: 'Daytime; skip cave torches.' };
  }
  const pos = bot.entity.position;
  const fp = typeof pos.floored === 'function' ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const ref = bot.blockAt(fp.offset(0, -1, 0));
  if (!ref) return partial('No footing.');
  try {
    await bot.equip(torch, 'hand');
    await bot.placeBlock(ref, new Vec3(0, 1, 0));
  } catch (e) {
    return partial(e.message || 'Torch place failed.');
  }
  return { success: true, reason: 'Placed torch above feet (dark / night).' };
}

async function drinkMilkClearEffects(bot, state) {
  const m = bot.inventory.items().find((i) => i.name === 'milk_bucket');
  if (!m) return partial('Need milk bucket.');
  try {
    await bot.equip(m, 'hand');
    await bot.consume();
  } catch (e) {
    return partial(e.message || 'Drink milk failed.');
  }
  return { success: true, reason: 'Drank milk (clears effects).' };
}

async function sprintJumpGap(bot, state) {
  try {
    bot.setControlState('forward', true);
    bot.setControlState('sprint', true);
    bot.setControlState('jump', true);
    await sleep(280);
    bot.setControlState('jump', false);
    bot.setControlState('sprint', false);
    bot.setControlState('forward', false);
  } catch (e) {
    return partial(e.message || 'Movement failed.');
  }
  return { success: true, reason: 'Sprint-jump burst (cross gaps manually).' };
}

async function waveAtNearbyPlayer(bot, state) {
  const pl = bot.nearestEntity((e) => e && e.type === 'player' && e.username && e.username !== bot.username);
  if (!pl || !pl.position) return partial('No other player in range.');
  try {
    await gotoTimeout(bot, new GoalGetToBlock(pl.position.x, pl.position.y, pl.position.z), Math.min(14000, GOTO_MS));
    await bot.lookAt(pl.position.offset(0, 1.62, 0), true);
    for (let i = 0; i < 3; i++) {
      if (typeof bot.swingArm === 'function') bot.swingArm('right', true);
      await sleep(180 + Math.floor(Math.random() * 120));
    }
  } catch (e) {
    return partial(e.message || 'Wave failed.');
  }
  return { success: true, reason: 'Waved at nearby player.' };
}

async function glanceBehind(bot, state) {
  if (!bot.entity || typeof bot.look !== 'function') return partial('No entity/look.');
  try {
    const y0 = bot.entity.yaw;
    const p0 = bot.entity.pitch;
    const yaw = y0 + Math.PI + (Math.random() - 0.5) * 0.35;
    const pitch = Math.max(-0.5, Math.min(0.45, p0 + (Math.random() - 0.5) * 0.2));
    await bot.look(yaw, pitch, true);
    await sleep(350 + Math.floor(Math.random() * 400));
    await bot.look(y0, p0, true);
  } catch (e) {
    return partial(e.message || 'Glance failed.');
  }
  return { success: true, reason: 'Checked behind (paranoia tick).' };
}

async function collectRedstoneDust(bot, state, params) {
  const n = params.count || 8;
  const r1 = await miningSkill.run(bot, state, {
    blockName: 'redstone_ore',
    count: n,
    countAsNames: ['redstone'],
  });
  if (countItems(bot, 'redstone') >= n) return { success: true, reason: `Have ${countItems(bot, 'redstone')} redstone.` };
  const r2 = await miningSkill.run(bot, state, {
    blockName: 'deepslate_redstone_ore',
    count: n,
    countAsNames: ['redstone'],
  });
  if (r2.success || countItems(bot, 'redstone') >= n) return r2;
  return r1;
}

module.exports = {
  ride_boat: rideBoat,
  ride_minecart: rideMinecart,
  use_elytra: useElytra,
  throw_pearl_escape: throwPearlEscape,
  place_blocks_fill: placeBlocksFill,
  flatten_with_shovel: flattenWithShovel,
  ignite_tnt: igniteTnt,
  use_shield_block: useShieldBlock,
  bow_snipe: bowSnipe,
  splash_potion_combat: splashPotionCombat,
  eat_golden_apple: eatGoldenApple,
  use_totem: useTotem,
  chorus_fruit_escape: chorusFruitEscape,
  respawn_anchor_nether: respawnAnchorNether,
  barter_piglin: barterPiglin,
  use_composter: useComposter,
  bone_meal_crops: boneMealCrops,
  carve_pumpkin: carvePumpkin,
  dye_wool: dyeWool,
  rename_name_tag: renameNameTag,
  lead_mob: leadMob,
  trade_rotate_stock: tradeRotateStock,
  cure_zombie_villager: cureZombieVillager,
  raid_farm: raidFarm,
  iron_golem_guard: ironGolemGuard,
  snow_golem_farm: snowGolemFarm,
  collect_bamboo: collectBamboo,
  craft_scaffolding: craftScaffolding,
  use_spyglass: useSpyglass,
  brush_archaeology: brushArchaeology,
  trim_armor_smithing: trimArmorSmithing,
  wolf_armor_equip: wolfArmorEquip,
  place_light_level_safe: placeLightLevelSafe,
  bucket_lava_safe: bucketLavaSafe,
  create_netherite_gear: createNetheriteGear,
  firework_rocket_boost: fireworkRocketBoost,
  book_and_quill: bookAndQuill,
  lectern_read: lecternRead,
  armor_stand_pose: armorStandPose,
  item_frame_map_wall: itemFrameMapWall,
  redstone_door_trap: redstoneDoorTrap,
  hopper_sort: hopperSort,
  auto_furnace_fuel_line: autoFurnaceFuelLine,
  xp_orb_collect_mend: xpOrbCollectMend,
  sneak_bridge_void: sneakBridgeVoid,
  pillar_up_jump: pillarUpJump,
  water_bucket_mlgb: waterBucketMlg,
  eat_dried_kelp_fast: eatDriedKelpFast,
  organize_chest_tabs: organizeChestTabs,
  bundle_items: bundleItems,
  shulker_box_kit: shulkerBoxKit,
  collect_netherrack: collectNetherrack,
  consume_cooked_meat: consumeCookedMeat,
  craft_lantern: craftLantern,
  craft_iron_shovel: craftIronShovel,
  craft_arrow_batch: craftArrowBatch,
  collect_flint_extra: collectFlintExtra,
  place_torch_hostile_cave: placeTorchHostileCave,
  drink_milk_clear_effects: drinkMilkClearEffects,
  sprint_jump_gap: sprintJumpGap,
  collect_redstone_dust: collectRedstoneDust,
  wave_at_nearby_player: waveAtNearbyPlayer,
  glance_behind: glanceBehind,
};
