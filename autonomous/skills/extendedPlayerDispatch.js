'use strict';

/**
 * Routes catalog `extended` tasks (former stubs + extras) to concrete handlers.
 * params._taskId is set by the executor.
 */

const handlersA = require('./extendedPlayerHandlersA');
const handlersB = require('./extendedPlayerHandlersB');
const humanPlayHandlers = require('./humanPlayHandlers');

const HANDLERS = { ...handlersA, ...handlersB, ...humanPlayHandlers };

async function run(bot, state, params = {}) {
  const id = params._taskId;
  const fn = HANDLERS[id];
  if (!fn) {
    return { success: false, reason: `extendedPlayerDispatch: no handler for "${id}".` };
  }
  return fn(bot, state, params);
}

module.exports = { run, HANDLERS };
