'use strict';

const { ROADMAP_PHASES } = require('./roadmapPhases');

/**
 * Single flattened order from phase groups (linear baseline). Replace with a real DAG later
 * when tasks gain explicit dependencies beyond planner.js ordering.
 */
function flattenPhasesToTaskOrder() {
  return ROADMAP_PHASES.flatMap((ph) => [...ph.taskIds]);
}

module.exports = { flattenPhasesToTaskOrder, ROADMAP_PHASES };
