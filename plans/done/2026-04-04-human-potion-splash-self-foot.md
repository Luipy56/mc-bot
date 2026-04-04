# Drop splash healing at feet when cornered and drink animation too slow

**Status:** implemented
**Related:** Jarvys human-play backlog; `autonomous/`; proposed catalog `taskId` `human_human_potion_splash_self_foot`.

## Summary

Drop splash healing at feet when cornered and drink animation too slow.

## Scope and out of scope

**In scope:** New or extended behavior entirely under `autonomous/` (combat;alchemy), wired through existing skill/executor patterns where possible; tests under `autonomous/tests/`; optional `playerSkillCatalog.js` row with status `live-addon` or `extended` until stable.

**Out of scope:** `basic/` and `viewer/` bots; full parity with PvP players; modded item namespaces; hard-coded coordinates on public servers.

## Assumptions and risks

Server `VERSION` must match supported Mineflayer features. Plugins (claims, anti-cheat) may cancel placements or rotations—surface clear `failReason` in logs. Some behaviors are opt-in via env flags to avoid breaking speedrun-style roadmap.

## Numbered steps

1. Implement logic in `autonomous/skills/` (new file or extend closest skill: `movement.js`, `combat.js`, `survival.js`, `building.js`, etc.); follow existing async patterns used by `executor.js`. **Done:** exported handler callable from `bot.js` skills map.
2. Register `taskId` `human_human_potion_splash_self_foot` in `autonomous/bot.js` if exposed as a task; add entry to `autonomous/lib/playerSkillCatalog.js`. **Done:** dispatch resolves without throw.
3. Add `autonomous/tests/human-potion-splash-self-foot.test.js` or extend the nearest behavioral test with mocks. **Done:** `cd autonomous && npm test` passes.
4. If the planner should schedule it, add conservative conditions in `autonomous/lib/planner.js` and/or `autonomous/lib/brain.js` behind flags. **Done:** covered by tests or documented manual probe.

## Verification order

`cd autonomous && npm test`

Optional live probe: `STATE_FILE=/tmp/jarvys-probe.state.json timeout 300 node bot.js` (see `.cursor/rules/jarvys-autonomous-testing.mdc`).

## Checkpoints

- Before enabling in default roadmap: líder approves priority vs speedrun tasks.
- New `blackboard` keys require `autonomous/lib/blackboardSchema.js` update + schema test.
- If behavior is risky (void, lava, pearls), ship behind `process.env` toggle first.
