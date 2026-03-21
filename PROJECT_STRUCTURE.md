# Project Structure

```
mc-bot/
├── AGENT.md              # Behavior rules for the autonomous dev agent
├── TASKS.md              # Current / Completed / Next task (single source of truth)
├── ROADMAP.md            # High-level development phases
├── PROMPT.md             # Reusable agent loop instruction
├── PROJECT_STRUCTURE.md  # This file
├── .env                  # NAME, SERVER_IP, PORT, VERSION (optional; autonomous/.env used when running bot)
├── .gitignore
├── basic/                # Minimal Mineflayer template (reference)
│   ├── bot.js
│   ├── package.json
│   └── .env.example
├── viewer/               # Bot + prismarine-viewer (reference)
│   ├── bot.js
│   ├── package.json
│   └── .env.example
├── autonomous/           # Main autonomous agent (Minecraft bot + task loop)
│   ├── bot.js            # Entry: createBot, load plugins, start autonomous loop
│   ├── package.json
│   ├── .env              # NAME, SERVER_IP, PORT, VERSION (or MC_*)
│   ├── .env.example
│   ├── lib/              # Core logic
│   │   ├── config.js     # Env loading (NAME → MC_USERNAME, SERVER_IP → MC_HOST)
│   │   ├── kickReason.js # Kick message parsing + slow-reconnect hints
│   │   ├── inventoryQuery.js # countItems, hasItem, countAllLogs
│   │   ├── brain.js        # nextTask: sync + critical interrupt + roadmap + explore substitution
│   │   ├── planner.js      # nextRoadmapTask (orden del juego, sin percepción)
│   │   ├── retryPolicy.js  # fallos, cooldown por tarea
│   │   ├── situation.js    # hostiles, syncProgressFromInventory, updateSituation
│   │   ├── perception.js # Bot → GameState snapshot
│   │   ├── state.js      # GameState, Progress, Blackboard
│   │   ├── goals.js      # Main + sub-goals
│   │   └── executor.js   # Run task via skills, update state, re-eval
│   └── skills/           # Encapsulated behaviors
│       ├── movement.js   # Pathfinder goto, setControlState
│       ├── mining.js     # dig / collectBlock, tool selection
│       ├── diamondCave.js # diamantes: búsqueda amplia + descenso a cueva / deepslate
│       ├── crafting.js   # craft, recipesFor
│       ├── smelting.js   # horno: fundir hierro → lingotes
│       ├── inventory.js  # inventory + chest
│       ├── combat.js     # attack, flee, armor
│       ├── building.js   # placeBlock
│       ├── buildWoodenHouse.js # casa 6x6 madera (suelo, paredes, techo)
│       ├── craftHousePlanks.js # craft masivo de oak_planks para la casa
│       ├── survival.js   # eat when hungry
│       ├── nether.js     # portal, blaze rods, ender pearls
│       ├── end.js        # eyes of ender, stronghold, dragon
│       ├── weapons.js    # equip best sword/axe
│       ├── explore.js    # pathfind a punto aleatorio (desatascar gather)
│       ├── retreat.js    # huir de hostiles (vida crítica)
│       ├── farming.js    # (optional) plant, harvest
│       └── trade.js      # (optional) villager
└── .cursor/              # Cursor rules and skills
    ├── rules/
    ├── skills/
    └── plans/
```

## Autonomous control (vs. community patterns)

The Prismarine ecosystem often uses **finite state machines** (e.g. [mineflayer-statemachine](https://github.com/PrismarineJS/mineflayer-statemachine): states + `shouldTransition`) or **task queues** for sequential actions. This project uses a **single-runner task loop** in `autonomous/bot.js` (one async runner, no overlapping `runTask`) plus **layered policy** in `lib/brain.js`: inventory/world sync → survival interrupts (retreat) → linear roadmap (`planner.js`) → retry/explore substitution (`retryPolicy.js`). That mirrors “behavior layers” from game AI without adding another dependency.
