# Tasks

## Current Task

(Agent runs autonomously; next task is chosen by planner from game state.)

## Completed Tasks

- Initialize project structure for Minecraft autonomous agent.
- Config and env mapping (NAME, SERVER_IP, PORT, VERSION).
- Movement skill (pathfinder goto).
- Mining skill (collect wood, cobblestone, coal, obsidian).
- Crafting skill (planks, sticks, crafting table, stone pick, chest, furnace, bed, blaze powder, eyes of ender).
- Inventory/chest skill (open, deposit, withdraw).
- Survival skill (eat when food low).
- Combat skill (attack mob, flee when low health).
- Building skill (place block).
- Nether skills (find/use portal, enter Nether, collect blaze rods, collect ender pearls).
- End skills (craft eyes of ender, find stronghold, enter End, attack Ender Dragon).
- Full planner progression: early → Nether → End → idle (game complete).
- **More tests:** unit tests (state, inventoryQuery, perception, planner, executor, survival, persistence, executor-timeout); `npm test` runs all + task loop.
- **Place bed / place chest:** tasks after craft_bed and craft_chest; use building skill.
- **Sleep in bed:** sleep skill (find bed, goto, bot.sleep); proposed when night (timeOfDay ≥ 12500); does not mark completed so can repeat each night.
- **Equip armor:** armor skill (best helmet, chestplate, leggings, boots from inventory); task after place_chest.
- **Task timeout:** executor wraps each skill in a timeout (default 120s, `TASK_TIMEOUT_MS`); on timeout returns failure and clears timer so process exits.
- **State persistence:** save/load progress + gameState + blackboard to `autonomous/.state.json`; load on startup, save after each task.
- **Inteligencia:** `syncProgressFromInventory` marca tareas cumplidas si el inventario ya tiene madera, planks, sticks, mesa, cobble, pico, carbón, cofre, horno, cama, obsidiana, blaze rods, perlas, polvo, ojos; `updateSituation` cuenta hostiles y guarda posición; de noche con ≥2 hostiles y cama colocada prioriza dormir antes que seguir; comida más exigente si hay peligro; `goto_test` usa spawn guardado o `GOTO_TEST_*` en .env; tarea `equip_weapon` antes de Nether/End.
- **Cerebro (`brain.js`):** antes del roadmap, interrupción crítica `retreat` si vida muy baja y hay hostiles; si una tarea de gather falla muchas veces o entra en cooldown → `explore_nearby` (pathfind aleatorio desde spawn); al explorar con éxito sube `miningMaxDistance` (hasta 96) y resetea fallos de la tarea atascada.
- **Camino hacia “pasarse el juego” (roadmap):** tras armadura/arma → colocar horno → minar hierro (`raw_iron`) → fundir lingotes (`smelting.js` + `openFurnace`) → pico de hierro → pala de piedra → grava/sílex → **flint and steel** → diamantes → **pico de diamante** → obsidiana → portal (encender con sílex si hay marco) → Nether → End → combate extendido contra dragón (`kill_ender_dragon` con bucle + ojos en `find_stronghold`). En servidor real hacen falta tiempo, suerte de seed y `TASK_TIMEOUT_MS` alto para el dragón.
- **Reintentos (`retryPolicy.js`):** cuenta fallos por `taskId`, tras N fallos cooldown (~45s); `explore`/`retreat` no acumulan fallos.
- **Tests:** `situation.test.js`, `weapons.test.js`, `retryPolicy.test.js`, `brain.test.js`, tests de planner (vía brain).

## Next Task

Run on server and tune behavior (e.g. timeouts, retries, base position). Optional: persist state to file, add farming/trading.
