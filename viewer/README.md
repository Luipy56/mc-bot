# Viewer — Mineflayer bot + 3D view

Mineflayer bot with optional browser viewer. Two ways to view/play:

| Mode | Command | Description |
|------|---------|--------------|
| **Bot + viewer** | `npm start` | Node bot connects to the server; 3D view at `http://localhost:3000` (WASD, chat in page). Uses [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer). |
| **Browser client** | `npm run web-client` | Full [prismarine-web-client](https://gitlab.com/PrismarineJS/prismarine-web-client): mineflayer runs in the browser, connects via WebSocket proxy. Open `http://localhost:8080`. |

## Setup

1. Copy `.env.example` to `.env` and set `MC_HOST`, `MC_USERNAME` (and optionally `MC_PORT`, `MC_VERSION`, `MC_AUTH`).
2. `npm install`
3. Run either:
   - `npm start` — bot + 3D viewer (controls on the viewer page; first/third person via `VIEWER_PERSPECTIVE`).
   - `npm run web-client` — browser client only (no Node bot; you control the client in the browser).

## Bot features (npm start)

- 3D viewer with keyboard controls (WASD, space, arrows, T for chat).
- Optional chat/command TCP servers (see `.env.example` for `CHAT_SERVER_PORT`, `COMMAND_SERVER_PORT`).
- In-game commands: `!time`, `!players`, `!health`; `jarvys ven` → `/tpa`; `ping` → `/msg … pong`; `!pr <message>` (SSH) when `PR_SSH_HOST` is set.

## Web client (npm run web-client)

- [prismarine-web-client](https://gitlab.com/PrismarineJS/prismarine-web-client): mineflayer + prismarine-viewer in the browser.
- Enter server host/port/version in the UI; default port 8080. No `.env` used by the web client; configure in the browser.
