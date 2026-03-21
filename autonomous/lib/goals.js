'use strict';

const MAIN_GOAL = 'Complete the game (defeat the Ender Dragon).';

const MILESTONES = [
  'Gather resources (wood, stone, food)',
  'Build base / house',
  'Craft essential tools',
  'Bed and spawn',
  'Survive nights',
  'Enter Nether',
  'Nether objectives (blaze rods, ender pearls)',
  'Prepare for End (eyes of ender, stronghold)',
  'Enter End',
  'Ender Dragon',
];

function getMainGoal() {
  return MAIN_GOAL;
}

function getMilestones() {
  return [...MILESTONES];
}

module.exports = { getMainGoal, getMilestones };
