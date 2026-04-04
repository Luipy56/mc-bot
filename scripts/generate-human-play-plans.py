# -*- coding: utf-8 -*-
"""Bootstrap human-play plan files under plans/pending/.

Re-running overwrites existing files matching DATE-*.md for the same DATE.
After handoff to the coder, edit individual plans in plans/pending/ or plans/done/.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "plans" / "pending"
DATE = "2026-04-04"

# slug||Summary (1–3 sentences).||focus areas (short)
RAW = r"""
human-crouch-one-block-gap||The bot holds sneak when navigating 1-block-tall passages so goals complete instead of aborting. Mimics cautious cave crawling.||movement
human-peek-corner-before-cave||Before committing into a tunnel, offset look and sample air blocks / entity hints without fully entering. Reduces creeper face-checks.||perception
human-backpedal-melee-kite||Against a single melee mob, interleave short retreats and weapon swings instead of standing still. Improves survivability on low armor.||combat
human-walk-cliff-no-sprint||Disable sprint near steep drops or when adjacent air below feet; prefer walk speed until terrain is safe.||movement
human-cactus-padding-check||Before squeezing past cactus, verify armor or detour; never sprint-blind through desert chokepoints.||movement;survival
human-retreat-after-flint-ignite||After lighting portal or netherrack, step back a few ticks before hostiles or fire spread react.||nether;safety
human-strafe-circle-one-mob||When locked onto one hostile in open terrain, orbit at weapon range with small radius changes.||combat
human-sprint-jump-two-block-gap||Attempt measured sprint-jump only when hunger and fall risk allow; otherwise place stepping block.||movement
human-180-glance-hostile-rear||Periodically quick-look behind when walking away from combat zones or after hearing hurt sounds.||perception
human-pause-lava-biome-edge||When chunk light drops and lava pops nearby, stop forward motion until floor blocks are confirmed solid.||mining;safety
human-sneak-deepslate-bridge||Cross narrow deepslate lips over void or lava on sneak with slower pathfinder max speed.||movement
human-stand-still-while-eating||Block movement input during consume animation so food registers reliably like a standing player.||survival
human-prefer-cooked-meat-raw||If both exist, prefer cooked stacks for saturation; raw only when desperate or for breeding/trading prep.||survival
human-swim-surface-breathe-gap||In water, favor surfacing cadence and avoid digging straight up into gravel while oxygen is low.||movement
human-vine-over-scaffold-if-available||When ascending, prefer existing vines/ladders in reach before spending scaffolding or pillar blocks.||building;movement
human-hotbar-order-tool-blocks-food||Reorder hotbar to a stable human-like layout: tools left, blocks middle, food right when idle at chest.||inventory
human-ignore-rotten-flesh-nearly-full||Skip pickup of low-value hunger items when inventory pressure is high unless truly starving.||inventory
human-reserve-emergency-food-slot||Keep one dedicated food stack in a predictable slot and avoid merging it into bulk processing by accident.||inventory
human-pickup-priority-nearby-diamonds||When multiple drops compete, bias pickup toward ores and combat drops over stone/cobble.||inventory
human-toss-cobble-for-valuable-space||If inventory full and a valuable entity drop is nearby, drop lowest-priority filler blocks first.||inventory
human-offhand-torch-when-mining-dark||While mining underground with weapon in main hand, move torch to offhand when block light is below threshold.||mining
human-offhand-shield-when-hostile-near||Swap shield to offhand when skeleton/trident threat detected even if tool was there.||combat
human-close-door-after-flee-indoors||After pathing through a door to escape mobs, interact to close it if rules allow and no ally follows.||building;survival
human-slab-path-up-slope-walk||Place or follow half-slab stair paths on hills instead of jumping every block when materials allow.||building;movement
human-glass-pane-slim-windows||For openings, prefer glass panes over full blocks when building “windows” for light with less material.||building
human-fence-gate-click-through-mule||Open fence gates only as wide as needed, re-close after passage to reduce mob leakage.||building
human-carpet-iceSlow-buffer-strip||Lay short carpet strips before packed ice paths to shed speed before cliffs (human panic brake).||building;movement
human-lantern-under-hang-sign||Place lanterns under hanging signs or chains for ceiling light without full block loss of headroom.||building
human-sign-chest-row-labels||Write short signs or item-frame codes above grouped chests for base orientation (bot-readable blackboard sync).||building;utility
human-trapdoor-stair-climb-human-tempo||Climb trapdoor staircases with deliberate delay between opens to avoid head bonk loops.||movement
human-flower-pot-spruce-sapling-nook||Decorate safe corners with flower pots + sapling for cheap “lived-in” base feel and waypoint memory.||building
human-wheat-row-replant-tail||After harvesting a wheat row, replant from the far end backward so the bot does not trample fresh soil.||farming
human-carrot-line-replant-golden-food||Maintain carrot lines with golden carrot craft path awareness when gold is available later.||farming
human-beetroot-seed-stock-soup-ready||Keep a minimum beetroot seed buffer before converting all to soup components.||farming
human-melon-consume-slices-only||Eat melon slices instead of breaking full blocks for food when slices exist.||survival;farming
human-pumpkin-face-carve-before-place||Carve pumpkins with shears before placing jack-o-lantern or golem face needs.||crafting;building
human-cocoa-fence-tiny-farm||Create minimal jungle cocoa on fence pillars with water edge rule like a compact human farm.||farming
human-nether-wart-bounded-box-harvest||Harvest nether wart only inside bounded soul sand box to avoid losing drops in lava.||farming;nether
human-sweet-berry-bush-damage-sneak||Approach berry bushes on sneak or from the side to reduce prick damage while picking.||farming;survival
human-creeper-five-block-rule||Maintain minimum distance buffer when creeper fuse audio ticks; backpedal before DPS race if HP low.||combat
human-skeleton-shield-pitch-aim||Adjust look pitch toward skeleton head height when blocking arrows with shield.||combat
human-spider-ceiling-look-up-strike||When spider is above, prioritize upward aim and jump timing instead of ground sweeps.||combat
human-enderman-avoid-crosshair-face||Deliberately angle camera away from enderman hitbox when not hunting pearls.||combat;survival
human-slime-small-swarm-priority||When big slime splits, target small cubes nearest to weapon reach first to reduce chip damage.||combat
human-witch-milk-after-poison||After poison applied, path to milk bucket use with safe timeout (clear effects).||survival;combat
human-phantom-sleep-first-bow-second||If bed valid and phantoms spawn, prefer sleep task over prolonged sky bow kiting.||survival
human-drowned-ranged-trident-kite||Keep lateral distance from drowned with visible trident; use shield or terrain breaks.||combat
human-hoglin-shield-timed-block||Time shield for hoglin charge knockback windows; avoid trading during stun.||combat;nether
human-piglin-single-gold-ingot-barter-cadence||Drop one gold ingot at a time and wait pickup animation before next (human-like barter).||nether;social
human-zpiglin-peace-walk-wide-berth||Path around zombified piglin packs with margin; never sprint-punch through neutral crowds.||nether
human-blaze-doorframe-snipe||Use doorway peeks to limit blaze line of sight instead of open fortress hall standoff.||combat;nether
human-ghast-deflect-angry-return||When fireball close, prioritize punch reflect angle over panic sprint into lava.||combat;nether
human-shulker-cover-shield-bullets||Raise shield for shulker bullets when cover blocks unavailable; strafe toward pillar.||combat;end
human-vindicator-door-axe-break-predict||If vindicator is chopping door, either swap to blocking or reposition before door breaks.||combat
human-portal-frame-corner-min-obsidian||Build portal frames using corner-first placement habit to reduce miscount errors.||nether
human-fire-charge-spare-ignite-portal||If flint steel durability low, attempt fire charge ignition when available as backup.||nether
human-end-gateway-respawn-wait-timer||After dragon, respect gateway cooldown feel: pause before re-entering fight zone blindly.||end
human-crystal-tower-duck-behind-pillar||During crystal phase, break line of sight to dragon breath between shots.||end;combat
human-dragon-perch-bow-lead-target||When dragon perches, aim with slight lead based on animation phase (best-effort).||end;combat
human-chorus-only-low-health-chaos||Consume chorus fruit teleport only when trapped or critically low, not for casual travel.||end;survival
human-breath-bottle-collect-after-dragon||After fight, collect dragon breath in bottles when glass bottles free (human completionist).||end;alchemy
human-return-end-platform-slot-tool||Ensure pickaxe in safe slot before jumping back through end portal platform mining.||end;inventory
human-lever-cart-station-hop||Use lever to release minecart at station stops instead of punching cart off rails.||redstone;movement
human-noteblock-door-chime-click||Click note block at base entrance as arrival signal (optional social cue on multiplayer).||redstone;social
human-bow-target-block-skill-range||Practice bow on target block at safe range to calibrate hold time before real fights.||combat;utility
human-map-frame-rotate-north-up||Rotate item-frame maps to consistent north-up for human navigation habits.||utility;building
human-composter-return-bonemeal-loop||Feed composter with excess seeds/sticks and reclaim bonemeal when farming loop active.||farming;utility
human-daylight-lamp-skylight-base||Place lamps triggered by daylight sensor for automatic “home lights at dusk” feel.||redstone;building
human-tripwire-alarm-tunnel-entry||String tripwire across branch mine entrance for early hostile alert (hear click).||redstone;mining
human-villager-unlock-line-of-sight||Step so villager can see workstation for profession refresh before trading spam.||social
human-golem-guard-radius-no-punch||Never accidentally punch iron golem while clicking doors or chests near village center.||social;survival
human-cat-path-ointment-scare-radius||Path near cats when creeper threat in overworld base perimeter (soft escort).||social;combat
human-wolf-heal-bone-steak-cycle||Heal tamed wolves with meat when low; sit/stand commands respected around cliffs.||social;survival
human-parrot-no-chocolate-ever||Never feed cookies to parrots; use seeds only (hard safety invariant).||social;survival
human-villager-night-near-bed-waits||At night near village, idle in lit areas and avoid breaking beds villagers path to.||social;survival
human-thunder-hide-under-roof||When thunder starts, pause outdoor tower building and seek roof or shallow cave mouth.||survival;weather
human-afk-fish-occasional-recast||While fishing, add occasional recast jitter and small look drift to avoid perfect bot rhythm.||gathering;humanize
human-morning-farm-walkthrough-tick||At dawn, walk crop rows once checking maturity before mining tasks resume.||farming;routine
human-branch-mine-torch-left-wall||Consistent torch placement on left wall in branch mines for human “breadcrumb” symmetry.||mining
human-gravel-ceiling-safe-tap||Before mining up through gravel, place torch pillar break trick or side-step column.||mining;safety
human-lava-sea-basalt-stepping-stones||When crossing narrow lava, place basalt/cobble stepping with sneak between placements.||mining;nether
human-deepslate-damage-throttle-food||In deepslate layers, eat earlier than overworld due to starvation + mob pressure stacking.||mining;survival
human-spawner-torch-cage-first||Light all faces of a found spawner room before breaking cage blocks.||mining;combat
human-amethyst-geode-quiet-harvest||Harvest buds with silk expectation check; avoid loud unnecessary block breaks inside geode.||mining
human-idle-camera-micro-yaw-noise||When standing idle safe, apply tiny random yaw updates within bounds (not full spin).||humanize;movement
human-near-player-arm-swing-greeting||If another player is within chat range and non-hostile, occasional arm swing “wave” (no chat spam).||social;humanize
human-parkour-velocity-reset-human-cooldown||After failed jump, wait brief cooldown before retry instead of frame-perfect respam.||movement;humanize
human-cow-milk-cooldown-throttle-space||Throttle milk attempts per cow with spacing so animations complete and server accepts.||gathering
human-mooshroom-shear-bowl-mushroom-stew||Shear mooshroom with bowl ready to obtain stew in one human-like sequence.||gathering;survival
human-turtle-egg-mark-danger-no-step||Mark turtle egg zones in blackboard and pathfind around sand patches in bases.||building;survival
human-ravager-stun-shield-react||When ravager roar stun expected, pre-raise shield and angle toward impact side.||combat
human-evoker-fang-line-side-step||Strafe perpendicular to evoker fang line pattern on first visual cue.||combat
human-pillager-patrol-horn-retreat-door||On raid horn distant, preemptively move toward defensible door and close gates.||combat;social
human-bee-angry-smoke-campfire-calm||Place campfire smoke near hive before bottle/shear operations to reduce anger odds.||gathering;survival
human-strider-saddle-dis-mount-lava-shore||Dismount strider only on safe shore blocks; never jump off over open lava.||nether;movement
human-magma-cube-space-jump-dodge||Use vertical spacing and backward hops against large magma cubes in basalt deltas.||combat;nether
human-wither-rose-pick-soulsand-skip||Avoid picking wither rose without hoe/space plan; mark dangerous floor patches.||nether;survival
human-conduit-power-ring-prismarine-check||Before ocean monument work, verify prismarine block counts for conduit activation ring.||utility;ocean
human-beehive-silk-night-harvest-safe||Prefer silk touch night harvest with campfire calm and clear escape path.||gathering
human-axolotl-bucket-rehome-water-kelp||Bucket axolotl transport with guaranteed water pool + kelp at destination for regeneration context.||gathering;social
human-snow-layer-path-compaction||On snow biomes, shovel excess snow layers on main paths to reduce sprint stutter.||movement;building
human-bamboo-raft-river-cross||Use small bamboo raft craft and single crossing when boat unavailable but bamboo plentiful.||movement
human-dripstone-cauldron-water-farm||Passive water fill via pointed dripstone over cauldron for slow sustainable bottles.||fluids;farming
human-mud-dry-bricks-wind||Pack mud into clay renew mindset: dry mud bricks for early decorative walls near rivers.||building
human-cherry-blossom-sapling-avenue||Plant cherry saplings in avenue pattern near base for landmark navigation memory.||building
human-moss-bonemeal-stone-brush||Use moss spread on stone for organic cave-floor conversion before strip mining branches.||mining;farming
human-rooted-dirt-hanging-root-harvest||Harvest hanging roots safely under rooted dirt without breaking whole ceiling unexpectedly.||gathering
human-mudbrick-wall-trim||Use mud bricks as trim layers on wooden houses for contrast like player builds.||building
human-copper-oxidize-wax-preserve||Wax copper builds selected for aesthetics to prevent ugly patchy oxidation on bases.||building
human-lightning-rod-chimney-stack||Place lightning rod atop highest base column to protect wooden roofs during storms.||building;survival
human-bookshelf-enchant-power-ring||Surround enchanting table with bookshelf count that matches desired power tier before rolling.||gear
human-grindstone-disenchant-junk-first||Before anvil merges, grindstone trash enchants off cheap gear to recover small XP.||gear
human-smithing-template-duping-skip||Never assume template duplication; plan one-time trim template usage carefully.||gear
human-bundle-sort-food-kelp||Pack food and kelp snacks into bundle for long cave trips when bundle item exists.||inventory
human-shulker-color-code-kits||Name or slot shulker boxes by color for kit categories (mining, potions, building).||inventory;end
human-elytra-chorus-backup-slot||Keep chorus fruit in dedicated slot when elytra flying over void for emergency pop.||end;movement
human-firework-crossbow-rocket-elytra||Support rocket-boost via crossbow-held fireworks when main hand busy (version gated).||movement;end
human-totem-offhand-swap-predict||When entering risky PvE clusters, pre-equip totem offhand before first hit arrives.||survival;combat
human-golden-apple-clutch-threshold||Use golden apple only under configurable HP threshold or wither effect present.||survival;combat
human-potion-splash-self-foot||Drop splash healing at feet when cornered and drink animation too slow.||combat;alchemy
human-lingering-cloud-kite||Throw lingering harm outward while retreating from swarm mobs (best-effort).||combat;alchemy
human-bucket-lava-nether-secure-bin||Store lava buckets only in marked chest away from wood after nether trips.||nether;inventory
human-powder-snow-freeze-break||Detect powder snow freeze and break out with bucket or pick per version mechanics.||survival;movement
human-powder-snow-goat-horn-dodge||Listen for goat ram audio; sidestep near powder snow edges.||combat;survival
human-sculk-sensor-sneak-crouch-base||Move on sneak past sculk sensors in ancient city when warden risk mode enabled.||mining;survival
human-warden-darkness-panic-torch||On darkness effect, place temporary light or retreat along memorized path.||mining;combat
human-recovery-compass-death-run||Use recovery compass target to bias explore return path after death respawn.||survival;utility
human-anchor-charge-respawn-nether||Charge respawn anchor safely in enclosed room with explosion padding calculation.||nether;survival
human-bastion-chest-piglin-milk||Open bastion chest only after gold distraction drop and escape route marked.||nether;inventory
human-endermite-pearl-minimal-use||Track endermite spawn risk; avoid pearl spam in stronghold corridors.||end;movement
human-silverfish-stop-on-infest-hint||If breaking stone spawns silverfish in stronghold, switch to sword and stop pickaxe tunnel.||mining;combat
human-fossil-bone-meal-brush||Brush suspicious gravel near fossils for bone blocks without destroying whole vein.||gathering
human-suspicious-sand-temple-care||Brush desert temple suspicious sand from side supports to avoid plate detonation.||gathering;safety
human-minecart-furnace-boost-burst||Use furnace minecart short boost on long straight rail climbs (when rails exist).||redstone;movement
human-boat-jump-momentum-skip||Use boat on ice edge jump tricks only when HP high and gap measured (opt-in risky).||movement
human-leash-villager-pit-fallback||Never implement unethical traps; instead document skip: only move villagers with boat/minecart humane paths.||social;ethics
human-donate-emerald-throw-party||Rare idle: toss single emerald near villager as flavor “gift” if surplus high (server rules permitting).||social;humanize
human-cake-place-birthday-nook||Craft and place cake in corner with sign date for base milestone (blackboard flag).||building;social
human-jukebox-disc-pause-combat||Stop disc playback when hostile enters radius to hear footsteps (human paranoia).||utility;survival
human-item-frame-secret-stash-cover||Hide low-value item frame on “empty” wall panel that marks stash behind (metadata only).||building;utility
human-redstone-lamp-floor-night||Wire redstone lamp floor segment toggled by pressure plate entrance for foyer.||redstone;building
human-dispenser-arrow-turret-manual||Single dispenser + button arrow burst for pillar crystal phase assist (manual aim setup).||redstone;end
human-piston-door-thumb-pattern||Compact piston door with memorized block break order for exit during raids.||redstone;building
human-hopper-minecart-under-furnace||Under-furnace hopper minecart collection for smelting output like mini auto-smelt.||redstone;processing
human-water-elevator-bubble-column||Build soul sand bubble elevator for vertical base travel when buckets available.||building;fluids
human-kelp-block-fuel-buffer||Compact dried kelp blocks as furnace fuel buffer before long smelt sessions.||processing
human-blast-furnace-ore-priority||Route raw ores to blast furnace when block exists near base for throughput.||processing
human-smoker-meat-priority||Route meats to smoker when available for faster post-hunt recovery.||processing;survival
human-stonecutter-stair-macro||Use stonecutter batch stairs for large builds instead of crafting table grid spam.||building;crafting
human-loom-banner-base-mark||Craft simple banner pattern as team/base marker on shields later in chain.||crafting;building
human-cartography-lock-map||Lock map in cartography table after area mapped to prevent accidental overlap redraw.||utility
human-bell-ring-panic-clear||Ring village bell during raid entry to gather villagers indoors (interaction hook).||social;combat
human-grindstone-xp-bank-smelt||Smelt quartz or cactus for small XP grind before enchant rerolls (human prep).||processing;gear
""".strip()


def render_md(slug: str, summary: str, focus: str) -> str:
    tid = "human_" + slug.replace("-", "_")
    title = summary.split(".")[0].strip()
    return f"""# {title}

**Status:** pending
**Related:** Jarvys human-play backlog; `autonomous/`; proposed catalog `taskId` `{tid}`.

## Summary

{summary}

## Scope and out of scope

**In scope:** New or extended behavior entirely under `autonomous/` ({focus}), wired through existing skill/executor patterns where possible; tests under `autonomous/tests/`; optional `playerSkillCatalog.js` row with status `live-addon` or `extended` until stable.

**Out of scope:** `basic/` and `viewer/` bots; full parity with PvP players; modded item namespaces; hard-coded coordinates on public servers.

## Assumptions and risks

Server `VERSION` must match supported Mineflayer features. Plugins (claims, anti-cheat) may cancel placements or rotations—surface clear `failReason` in logs. Some behaviors are opt-in via env flags to avoid breaking speedrun-style roadmap.

## Numbered steps

1. Implement logic in `autonomous/skills/` (new file or extend closest skill: `movement.js`, `combat.js`, `survival.js`, `building.js`, etc.); follow existing async patterns used by `executor.js`. **Done:** exported handler callable from `bot.js` skills map.
2. Register `taskId` `{tid}` in `autonomous/bot.js` if exposed as a task; add entry to `autonomous/lib/playerSkillCatalog.js`. **Done:** dispatch resolves without throw.
3. Add `autonomous/tests/{slug}.test.js` or extend the nearest behavioral test with mocks. **Done:** `cd autonomous && npm test` passes.
4. If the planner should schedule it, add conservative conditions in `autonomous/lib/planner.js` and/or `autonomous/lib/brain.js` behind flags. **Done:** covered by tests or documented manual probe.

## Verification order

`cd autonomous && npm test`

Optional live probe: `STATE_FILE=/tmp/jarvys-probe.state.json timeout 300 node bot.js` (see `.cursor/rules/jarvys-autonomous-testing.mdc`).

## Checkpoints

- Before enabling in default roadmap: líder approves priority vs speedrun tasks.
- New `blackboard` keys require `autonomous/lib/blackboardSchema.js` update + schema test.
- If behavior is risky (void, lava, pearls), ship behind `process.env` toggle first.
"""


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    lines = [ln for ln in RAW.splitlines() if ln.strip()]
    if len(lines) < 100:
        raise SystemExit(f"Expected at least 100 plan rows, got {len(lines)}")
    seen = set()
    for ln in lines:
        parts = ln.split("||")
        if len(parts) != 3:
            raise SystemExit(f"Bad line: {ln[:80]}")
        slug, summary, focus = parts
        if slug in seen:
            raise SystemExit(f"Duplicate slug: {slug}")
        seen.add(slug)
        out = ROOT / f"{DATE}-{slug}.md"
        out.write_text(render_md(slug, summary, focus), encoding="utf-8")
    print("wrote", len(lines), "files to", ROOT)


if __name__ == "__main__":
    main()
