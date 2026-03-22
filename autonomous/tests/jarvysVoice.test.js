#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { humanizeTask, voiceEnabled, gameChatEnabled, pick } = require('../lib/jarvysVoice');

function testHumanize() {
  assert.ok(humanizeTask('collect_wood').includes('wood'));
  assert.strictEqual(humanizeTask('unknown_xyz_task'), 'unknown xyz task');
}

function testPick() {
  const a = ['only'];
  assert.strictEqual(pick(a), 'only');
}

function testGameChatDefault() {
  const prev = process.env.JARVYS_VOICE_GAME_CHAT;
  try {
    delete process.env.JARVYS_VOICE_GAME_CHAT;
    assert.strictEqual(gameChatEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.JARVYS_VOICE_GAME_CHAT;
    else process.env.JARVYS_VOICE_GAME_CHAT = prev;
  }
}

function testVoiceEnabledDefault() {
  const prev = process.env.JARVYS_VOICE;
  try {
    delete process.env.JARVYS_VOICE;
    assert.strictEqual(voiceEnabled(), true);
    process.env.JARVYS_VOICE = '0';
    assert.strictEqual(voiceEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env.JARVYS_VOICE;
    else process.env.JARVYS_VOICE = prev;
  }
}

function run() {
  testHumanize();
  testPick();
  testGameChatDefault();
  testVoiceEnabledDefault();
  console.log('jarvysVoice.test.js: all passed');
}

run();
