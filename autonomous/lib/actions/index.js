'use strict';

const { GoalNear, GoalGetToBlock } = require('mineflayer-pathfinder').goals;

async function gotoNear(bot, x, y, z, radius = 2) {
  await bot.pathfinder.goto(new GoalNear(x, y, z, radius));
}

async function gotoBlock(bot, block, radius = 2) {
  if (!block?.position) throw new Error('gotoBlock: missing block');
  const p = block.position;
  await gotoNear(bot, p.x, p.y, p.z, radius);
}

async function lookAtBlockCenter(bot, block) {
  if (!block?.position) return;
  await bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
}

async function activateBlockSafe(bot, block) {
  await lookAtBlockCenter(bot, block);
  await bot.activateBlock(block);
}

module.exports = {
  gotoNear,
  gotoBlock,
  GoalGetToBlock,
  lookAtBlockCenter,
  activateBlockSafe,
};
