---
name: mineflayer-pathfinder
description: Add autonomous pathfinding to a Mineflayer bot using mineflayer-pathfinder. Use when the bot needs to walk to a position, follow a player, or navigate terrain (Goals, Movements, goto).
---

# Mineflayer Pathfinder

Add A* pathfinding so the bot can go from A to B, follow entities, or reach blocks. Plugin: [mineflayer-pathfinder](https://www.npmjs.com/package/mineflayer-pathfinder), [GitHub](https://github.com/PrismarineJS/mineflayer-pathfinder).

## When to use

- Bot must walk to coordinates or a player.
- Autonomous collection (e.g. go to nearest block type).
- Guard/follow behaviors.

## Install and load

```bash
npm install mineflayer-pathfinder
```

```js
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear, GoalBlock, GoalFollow } = require('mineflayer-pathfinder').goals;

bot.loadPlugin(pathfinder);
```

## Workflow

1. **After spawn** — Create movements and set them:
   ```js
   bot.once('spawn', () => {
     const defaultMove = new Movements(bot);
     bot.pathfinder.setMovements(defaultMove);
   });
   ```

2. **Set goal** — Use a Goal class:
   - `GoalNear(x, y, z, range)` — get within range of a point.
   - `GoalBlock(x, y, z)` — stand in that block.
   - `GoalFollow(entity, range)` — follow entity (use `setGoal(goal, true)` for dynamic).
   - `GoalGetToBlock(x, y, z)` — stand next to block (e.g. chest).

3. **Move** — `bot.pathfinder.setGoal(goal)` or await `bot.pathfinder.goto(goal)`.

4. **Stop** — `bot.pathfinder.stop()` (stops at next node) or `bot.pathfinder.setGoal(null)` (immediate).

## Example: "come" command

```js
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  if (message !== 'come') return;
  const target = bot.players[username]?.entity;
  if (!target) { bot.chat("I don't see you!"); return; }
  const p = target.position;
  bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1));
});
```

## Example: go to block (async)

```js
const block = bot.findBlock({ matching: (b) => b.name === 'chest', maxDistance: 32 });
if (block) {
  await bot.pathfinder.goto(new GoalGetToBlock(block.position.x, block.position.y, block.position.z));
}
```

## Events

- `path_update` — status: `success`, `partial`, `timeout`, `noPath`.
- `goal_reached` — goal satisfied (not for dynamic goals).
- `path_reset` — path cleared (e.g. stuck, block update).

## Tuning Movements

- `defaultMove.canDig = false` — don’t break blocks.
- `defaultMove.allow1by1towers = false` — no pillaring.
- `defaultMove.scafoldingBlocks.push(bot.registry.itemsByName.netherrack.id)` — allow netherrack for scaffolding.

See `.cursor/rules/mineflayer-pathfinder.mdc` for full Goals list and API.
