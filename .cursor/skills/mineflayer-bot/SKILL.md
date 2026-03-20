---
name: mineflayer-bot
description: Set up or extend a Mineflayer Minecraft bot with config from .env, spawn/chat/end handlers, and world API. Use when creating a new bot, connecting to a server, handling chat, or querying blocks/entities.
---

# Mineflayer Bot

Use when building or modifying Minecraft bots in this repo (basic, autonomous, viewer). Primary docs: [mineflayer.com](https://mineflayer.com/), [PrismarineJS/mineflayer](https://github.com/PrismarineJS/mineflayer).

## Quick setup

1. **Config from .env** — No host, port, username, or passwords in code. Use `require('dotenv').config()` and `process.env.MC_HOST`, `MC_USERNAME`, etc. Require `MC_HOST` and `MC_USERNAME`; exit with a clear message if missing.
2. **Create bot** — `mineflayer.createBot({ host, port, username, version, auth })`. Use `version: '1.21.11'` (or match server); `auth: 'offline'` for cracked/LAN.
3. **Spawn** — In `bot.on('spawn', ...)` send server login command from `process.env.MC_LOGIN_CMD` if set (e.g. `/login <password>`).
4. **Chat** — In `bot.on('chat', ...)` always skip own messages: `if (username === bot.username) return`.
5. **Reconnect** — In `bot.on('end', ...)` call `setTimeout(createBot, 3000)` (or configurable delay) to reconnect.

## World API (common)

- **Block:** `bot.findBlock({ matching: (b) => b.name === 'diamond_ore', maxDistance: 32 })` → block or null.
- **Blocks:** `bot.findBlocks({ matching: ..., maxDistance: 16, count: 5 })` → positions (closest first).
- **Entity:** `bot.nearestEntity(e => e.name === 'cow')`.
- **Position:** `bot.entity.position` (Vec3).

## Movement

- `bot.setControlState('forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint' | 'sneak', true | false)`.

## Project layout

- `basic/` — minimal template; new bots copy from here.
- `autonomous/` — same base, intended for pathfinding/automation.
- `viewer/` — bot + prismarine-viewer and extra features; config and login from .env.

Follow the rules in `.cursor/rules/mineflayer-bots.mdc` when editing `bot.js` files.
