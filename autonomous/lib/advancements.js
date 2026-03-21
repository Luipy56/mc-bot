'use strict';

/**
 * Logros del juego (advancements). El bot no recibe el paquete de avances del servidor,
 * así que inferimos completados por estado e inventario (y tareas ya hechas).
 * Definimos id, nombre, descripción y qué tarea o condición lo desbloquea.
 */

const { isCompleted } = require('./state');
const { hasItem, countItems } = require('./inventoryQuery');

/** Lista de logros conocidos: id, name, description, check(state, bot) → boolean */
const ADVANCEMENTS = [
  {
    id: 'minecraft:story/mine_stone',
    name: '¡Mina piedra!',
    description: 'Conseguir cobblestone con tu nuevo pico.',
    check: (state, bot) => isCompleted(state, 'collect_cobblestone') || (bot && hasItem(bot, 'cobblestone', 1)),
  },
  {
    id: 'minecraft:story/upgrade_tools',
    name: 'Mejora de herramientas',
    description: 'Fabricar un pico de piedra.',
    check: (state) => isCompleted(state, 'craft_stone_pick'),
  },
  {
    id: 'minecraft:story/smelt_iron',
    name: '¿No es hierro?',
    description: 'Conseguir una barra de hierro.',
    check: (state, bot) => isCompleted(state, 'smelt_iron_ingots') || (bot && hasItem(bot, 'iron_ingot', 1)),
  },
  {
    id: 'minecraft:story/obtain_armor',
    name: 'Protección ligera',
    description: 'Equipar una pieza de armadura de hierro.',
    check: (state) => isCompleted(state, 'equip_armor'),
  },
  {
    id: 'minecraft:story/lava_bucket',
    name: 'Lava caliente',
    description: 'Llenar un cubo de lava.',
    check: (state, bot) => bot && hasItem(bot, 'lava_bucket', 1),
  },
  {
    id: 'minecraft:story/iron_tools',
    name: '¿No es un pico de hierro?',
    description: 'Mejorar el pico a hierro.',
    check: (state, bot) => isCompleted(state, 'craft_iron_pickaxe') || (bot && hasItem(bot, 'iron_pickaxe', 1)),
  },
  {
    id: 'minecraft:story/craft_workbench',
    name: 'Referencia',
    description: 'Fabricar una mesa de crafteo.',
    check: (state, bot) => isCompleted(state, 'craft_crafting_table') || (bot && hasItem(bot, 'crafting_table', 1)),
  },
  {
    id: 'minecraft:story/craft_furnace',
    name: 'Tema candente',
    description: 'Fabricar un horno.',
    check: (state, bot) => isCompleted(state, 'craft_furnace') || (bot && hasItem(bot, 'furnace', 1)),
  },
  {
    id: 'minecraft:story/craft_chest',
    name: 'Inventario',
    description: 'Fabricar una caja.',
    check: (state, bot) => isCompleted(state, 'craft_chest') || (bot && hasItem(bot, 'chest', 1)),
  },
  {
    id: 'minecraft:story/mine_diamond',
    name: '¡Diamantes!',
    description: 'Conseguir diamantes.',
    check: (state, bot) => isCompleted(state, 'collect_diamond_ore') || (bot && hasItem(bot, 'diamond', 1)),
  },
  {
    id: 'minecraft:story/enter_the_nether',
    name: 'Hay que ir más profundo',
    description: 'Construir, encender y entrar en un portal al Nether.',
    check: (state) => isCompleted(state, 'enter_nether'),
  },
  {
    id: 'minecraft:story/follow_ender_eye',
    name: 'Al ojo',
    description: 'Llegar a la fortaleza.',
    check: (state) => isCompleted(state, 'find_stronghold'),
  },
  {
    id: 'minecraft:story/enter_the_end',
    name: 'El End',
    description: 'Entrar al End.',
    check: (state) => isCompleted(state, 'enter_end'),
  },
  {
    id: 'minecraft:end/kill_dragon',
    name: 'Liberar el End',
    description: 'Derrotar al dragón del End.',
    check: (state) => isCompleted(state, 'kill_ender_dragon'),
  },
  {
    id: 'minecraft:adventure/kill_a_mob',
    name: 'Cazador de monstruos',
    description: 'Matar a un monstruo hostil.',
    check: (state) => isCompleted(state, 'kill_enemy'),
  },
  {
    id: 'minecraft:adventure/sleep_in_bed',
    name: 'Buenas noches',
    description: 'Dormir en una cama para cambiar el punto de reaparición.',
    check: (state) => isCompleted(state, 'sleep_in_bed'),
  },
  {
    id: 'minecraft:husbandry/plant_seed',
    name: 'Un pedazo de pastel',
    description: 'Plantar una semilla y verla crecer.',
    check: (state) => isCompleted(state, 'build_potato_farm') || isCompleted(state, 'build_crop_farm'),
  },
];

function getCompleted(state, bot) {
  if (!state) return [];
  return ADVANCEMENTS.filter((a) => a.check(state, bot));
}

function getIncomplete(state, bot) {
  if (!state) return [...ADVANCEMENTS];
  return ADVANCEMENTS.filter((a) => !a.check(state, bot));
}

/**
 * Devuelve la tarea del roadmap que conviene hacer para completar el siguiente logro fácil.
 * Si ya no hay logros pendientes que dependan de una sola tarea, devuelve null.
 */
function getNextTaskForAdvancement(state, bot) {
  const incomplete = getIncomplete(state, bot);
  const taskOrder = [
    'collect_cobblestone',
    'craft_stone_pick',
    'craft_crafting_table',
    'craft_furnace',
    'craft_chest',
    'smelt_iron_ingots',
    'craft_iron_pickaxe',
    'equip_armor',
    'collect_diamond_ore',
    'kill_enemy',
    'sleep_in_bed',
    'build_potato_farm',
    'build_crop_farm',
    'enter_nether',
    'find_stronghold',
    'enter_end',
    'kill_ender_dragon',
  ];
  for (const taskId of taskOrder) {
    if (isCompleted(state, taskId)) continue;
    const adv = incomplete.find((a) => advancementNeedsTask(a.id, taskId));
    if (adv) return { taskId, advancement: adv };
  }
  return null;
}

function advancementNeedsTask(advId, taskId) {
  const map = {
    'minecraft:story/mine_stone': 'collect_cobblestone',
    'minecraft:story/upgrade_tools': 'craft_stone_pick',
    'minecraft:story/smelt_iron': 'smelt_iron_ingots',
    'minecraft:story/obtain_armor': 'equip_armor',
    'minecraft:story/iron_tools': 'craft_iron_pickaxe',
    'minecraft:story/craft_workbench': 'craft_crafting_table',
    'minecraft:story/craft_furnace': 'craft_furnace',
    'minecraft:story/craft_chest': 'craft_chest',
    'minecraft:story/mine_diamond': 'collect_diamond_ore',
    'minecraft:story/enter_the_nether': 'enter_nether',
    'minecraft:story/follow_ender_eye': 'find_stronghold',
    'minecraft:story/enter_the_end': 'enter_end',
    'minecraft:end/kill_dragon': 'kill_ender_dragon',
    'minecraft:adventure/kill_a_mob': 'kill_enemy',
    'minecraft:adventure/sleep_in_bed': 'sleep_in_bed',
    'minecraft:husbandry/plant_seed': 'build_potato_farm',
  };
  return map[advId] === taskId;
}

module.exports = {
  ADVANCEMENTS,
  getCompleted,
  getIncomplete,
  getNextTaskForAdvancement,
};
