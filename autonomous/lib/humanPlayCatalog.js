'use strict';

const { HUMAN_PLAY_TASK_IDS } = require('./humanPlayTaskIds');

function titleFromId(id) {
  const tail = id.replace(/^human_human_/, '');
  return tail
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const HUMAN_PLAY_CATALOG = HUMAN_PLAY_TASK_IDS.map((id) => ({
  id,
  category: 'humanize',
  title: titleFromId(id),
  description: 'Human-play micro-behavior; see plans/done/2026-04-04-human-*.md.',
  status: 'extended',
}));

module.exports = { HUMAN_PLAY_CATALOG, titleFromId };
