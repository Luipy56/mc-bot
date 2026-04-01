#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createState, setBlackboard } = require('../lib/state');
const { maybeAskMiningToolHelp, pickLine } = require('../lib/miningHelpChat');

function testPickLine() {
  assert.ok(pickLine('obsidian_pick').includes('obsidian') || pickLine('obsidian_pick').includes('pick'));
  assert.ok(pickLine('ancient_debris_pick').length > 10);
}

function testCooldown() {
  process.env.MINING_HELP_CHAT = '1';
  const state = createState();
  const bot = {
    chatCalls: 0,
    chat(msg) {
      this.chatCalls++;
      this.lastMsg = msg;
    },
  };
  const detail = { abort: true, kind: 'obsidian_pick' };
  maybeAskMiningToolHelp(bot, state, detail);
  assert.strictEqual(bot.chatCalls, 1);
  maybeAskMiningToolHelp(bot, state, detail);
  assert.strictEqual(bot.chatCalls, 1, 'cooldown blocks immediate second ask');
  setBlackboard(state, 'lastMiningHelpChatAt', Date.now() - 120000);
  maybeAskMiningToolHelp(bot, state, detail);
  assert.strictEqual(bot.chatCalls, 2);
}

function testSkipsWrongKind() {
  const state = createState();
  const bot = { chatCalls: 0, chat() { this.chatCalls++; } };
  maybeAskMiningToolHelp(bot, state, { abort: true, kind: 'unbreakable' });
  assert.strictEqual(bot.chatCalls, 0);
}

function run() {
  testPickLine();
  testCooldown();
  testSkipsWrongKind();
  console.log('miningHelpChat.test.js: all passed');
}

run();
