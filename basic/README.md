# Mineflayer LAN bot (Minecraft 1.21.x)

Basic bot using [Mineflayer](https://github.com/PrismarineJS/mineflayer) for Minecraft **1.21.11** (or other 1.21.x), prepared to run on a **LAN server**.

## Setup

```bash
cd mineflayer-bot
npm install
```

## Run on LAN server

**Same machine as the server (default):**
```bash
npm start
```

**Server on another machine** — set host and optionally port/username/version:

```bash
# Example: server at 192.168.1.100, default port 25565
MC_HOST=192.168.1.100 npm start

# Custom port and bot name
MC_HOST=192.168.1.100 MC_PORT=25566 MC_USERNAME=MyBot npm start

# If your LAN server is 1.21.4
MC_HOST=192.168.1.100 MC_VERSION=1.21.4 npm start
```

## Environment options

| Variable     | Default       | Description                    |
|-------------|---------------|--------------------------------|
| `MC_HOST`   | `localhost`   | Server IP or hostname          |
| `MC_PORT`   | `25565`       | Server port                    |
| `MC_USERNAME` | `MineflayerBot` | Bot in-game name            |
| `MC_VERSION`  | `1.21.11`    | Minecraft version (match server) |
| `MC_AUTH`   | `offline`     | `offline` for LAN; `microsoft` for premium |

## LAN server notes

- Most LAN / local servers use **offline mode** → `MC_AUTH=offline` (default).
- Set **MC_VERSION** to the exact server version (e.g. `1.21.4` or `1.21.11`) to avoid protocol mismatches.
- Ensure the server allows the bot’s username and that no firewall blocks the server port.

## Bot behavior

- Logs in, spawns, and sends a greeting in chat.
- Logs all chat messages.
- Replies `pong` when someone says `ping`.

**Jarvys assistant** (chat commands, prefix `!`):

| Command     | Description                          |
|------------|--------------------------------------|
| `!pr <message>` | Runs `openclaw agent --agent main --message "..."` on `amvara4` via SSH; output in chat |
| `!time`    | In-game day/night and bot position   |
| `!players` | List online players                  |
| `!health`  | Jarvys’ health and food (or `!status`) |

For **!pr**: the machine running the bot must have `ssh` to `amvara4`. Env: `PR_SSH_HOST` (default `amvara4`), `PR_TIMEOUT_MS` (default 60000).

Extend `bot.js` to add pathfinding, digging, or other behaviors.
