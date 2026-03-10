#!/usr/bin/env node
'use strict';

/**
 * Mineflayer bot for mc.pixelados.cc:25570 (1.21.11).
 * Fork of mineflayer-lan-bot. Override with env: MC_HOST, MC_PORT, MC_USERNAME, MC_VERSION, MC_AUTH.
 * Viewer: VIEWER_ENABLED (default 1), VIEWER_PORT (default 3000), VIEWER_PERSPECTIVE (first|third).
 * Controles en la misma página del viewer (teclado: WASD, espacio, flechas). STDIN_CONTROLS=1 para terminal.
 * Reconnect: JARVYS_RESTART_DELAY_MS (default 5000).
 */

const mineflayer = require('mineflayer');
const net = require('net');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const EventEmitter = require('events');
const express = require('express');
const http = require('http');
const { setupRoutes } = require('prismarine-viewer/lib/common');
const { WorldView } = require('prismarine-viewer/viewer');

const CHAT_SERVER_PORT = parseInt(process.env.CHAT_SERVER_PORT || '0', 10);
const SPAWN_CHAT_TERMINAL = /^1|true|yes$/i.test(process.env.SPAWN_CHAT_TERMINAL || '');
const CHAT_TERMINAL = process.env.CHAT_TERMINAL || 'gnome-terminal';
const COMMAND_SERVER_PORT = parseInt(process.env.COMMAND_SERVER_PORT || '0', 10);
const SPAWN_COMMAND_TERMINAL = /^1|true|yes$/i.test(process.env.SPAWN_COMMAND_TERMINAL !== undefined ? process.env.SPAWN_COMMAND_TERMINAL : '1');
const COMMAND_TERMINAL = process.env.COMMAND_TERMINAL || 'gnome-terminal';

// !pr: SSH host and command; override with env
const PR_SSH_HOST = process.env.PR_SSH_HOST || 'amvara4';
const PR_TIMEOUT_MS = parseInt(process.env.PR_TIMEOUT_MS || '60000', 10);
const MAX_CHAT_LEN = 256; // Minecraft chat limit
const RESTART_DELAY_MS = parseInt(process.env.JARVYS_RESTART_DELAY_MS || '5000', 10);
const VIEWER_ENABLED = /^1|true|yes$/i.test(process.env.VIEWER_ENABLED !== undefined ? process.env.VIEWER_ENABLED : '1');
const VIEWER_PORT = parseInt(process.env.VIEWER_PORT || '3000', 10);
const USE_STDIN_CONTROLS = /^1|true|yes$/i.test(process.env.STDIN_CONTROLS || '');
/** true = primera persona, false = tercera. Por defecto primera. */
const VIEWER_FIRST_PERSON = !/^0|false|no|third|tercera|3$/i.test(process.env.VIEWER_PERSPECTIVE || 'first');
/** Radianes que gira la cabeza por pulsación de flecha (↑↓←→). */
const LOOK_STEP = parseFloat(process.env.LOOK_STEP || '0.1');

/** Run openclaw on PR_SSH_HOST and send stdout/stderr to chat in chunks. */
function runOpenclawViaSsh(message, bot) {
  const innerCmd = `openclaw agent --agent main --message ${JSON.stringify(message)}`;
  const home = process.env.HOME || os.homedir();
  const sshConfig = `${home}/.ssh/config`;
  const cmd = `ssh -F "${sshConfig}" -o BatchMode=yes ${PR_SSH_HOST} bash -lc ${JSON.stringify(innerCmd)}`;
  const runningMsg = `[pr] Running on ${PR_SSH_HOST}...`;
  console.log('[Bot] Enviando:', runningMsg);
  bot.chat(runningMsg);
  const execOpts = {
    timeout: PR_TIMEOUT_MS,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, HOME: home }
  };
  exec(cmd, execOpts, (err, stdout, stderr) => {
    const out = (stdout && stdout.trim()) || '';
    const stderrStr = (stderr && stderr.trim()) || '';
    let text = out;
    if (stderrStr) text = text ? `${text}\n${stderrStr}` : stderrStr;
    if (err) text = text ? `(${err.message}) ${text}` : err.message || 'Command failed.';
    if (!text) text = 'No output.';
    const lines = text.split(/\r?\n/).filter(Boolean);
    const toSend = [];
    let buf = '';
    for (const line of lines) {
      if (buf.length + line.length + 1 <= MAX_CHAT_LEN) {
        buf = buf ? `${buf}\n${line}` : line;
      } else {
        if (buf) toSend.push(buf);
        buf = line.length <= MAX_CHAT_LEN ? line : line.slice(0, MAX_CHAT_LEN);
      }
    }
    if (buf) toSend.push(buf);
    if (toSend.length === 0) toSend.push('No output.');
    toSend.slice(0, 10).forEach((chunk, i) => {
      setTimeout(() => {
        const msg = `[pr] ${chunk}`;
        console.log('[Bot] Enviando:', msg);
        try { bot.chat(msg); } catch (e) { console.error(e); }
      }, i * 500);
    });
    if (toSend.length > 10) {
      setTimeout(() => {
        const msg = `[pr] ... (${toSend.length - 10} more chunks)`;
        console.log('[Bot] Enviando:', msg);
        try { bot.chat(msg); } catch (e) {}
      }, 10 * 500);
    }
    if (err) console.error('[pr]', err.message);
  });
}

// Pixelados server config — override with env vars
const config = {
  host: process.env.MC_HOST || 'mc.pixelados.cc',
  port: parseInt(process.env.MC_PORT || '25570', 10),
  username: process.env.MC_USERNAME || 'Jarvys',
  version: process.env.MC_VERSION || '1.21.11',
  auth: process.env.MC_AUTH || 'offline'  // 'offline' for cracked; 'microsoft' for premium
};

/** Bot actual; se actualiza en cada reconexión para que WASD/chat controlen el bot vivo. */
let currentBot;
/** Controles de movimiento expuestos para el viewer (se asignan en setupCliInput). */
let viewerMovementControls = null;

function createBot() {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: config.auth,
    // Suppress protocol parse errors for malformed world_particles (PartialReadError).
    // Server may send particle packets that don't match 1.21.11 spec; parser skips them but logs stacks otherwise.
    hideErrors: true
  });

  bot.on('login', () => {
    console.log(`[Bot] Logging in as ${config.username} → ${config.host}:${config.port} (${config.version})`);
  });

  bot.on('spawn', () => {
    console.log(`[Bot] Spawned at ${bot.entity.position}`);
    const loginCmd = '/login ^>wHZ+*82i';
    console.log('[Bot] Enviando:', loginCmd);
    bot.chat(loginCmd);
    if (VIEWER_ENABLED && viewerMovementControls) {
      startViewerWithControls(bot, viewerMovementControls);
      console.log(`[Bot] Viewer: http://localhost:${VIEWER_PORT} (${VIEWER_FIRST_PERSON ? 'primera' : 'tercera'} persona, controles por teclado en la página)`);
    }
  });

  /** Parsea línea de chat con formato "PREFIJO | nick: mensaje" y devuelve { sender, message } o null.
   *  Si tras el último | hay varias palabras (ej. "Atom  _gengis"), toma la última como nick. */
  function parsePlayerChatLine(line) {
    if (typeof line !== 'string') return null;
    const idx = line.indexOf(': ');
    if (idx === -1) return null;
    const message = line.slice(idx + 2).trim();
    const prefix = line.slice(0, idx).trim();
    const lastPipe = prefix.lastIndexOf('|');
    let sender = (lastPipe === -1 ? prefix : prefix.slice(lastPipe + 1)).trim();
    const parts = sender.split(/\s+/).filter(Boolean);
    if (parts.length > 0) sender = parts[parts.length - 1];
    if (!sender || !message) return null;
    return { sender, message };
  }

  bot.on('messagestr', (msg) => {
    console.log('[Chat]', msg);
    const parsed = parsePlayerChatLine(msg);
    if (!parsed) return;
    if (parsed.sender === bot.username) return;
    console.log('[Chat] Usuario:', parsed.sender, '| dijo:', parsed.message);
    const lower = parsed.message.toLowerCase();
    if (lower === 'jarvys ven') {
      const tpaCmd = '/tpa ' + parsed.sender;
      console.log('[Bot] Ejecutando /tpa (pedido por', parsed.sender + '):', tpaCmd);
      bot.chat(tpaCmd);
      return;
    }
    if (lower === 'ping') {
      const privCmd = '/msg ' + parsed.sender + ' pong';
      console.log('[Bot] Ejecutando pong por privado (pedido por', parsed.sender + '):', privCmd);
      bot.chat(privCmd);
      return;
    }
    if (lower.startsWith('!')) {
      if (lower.startsWith('!pr ')) {
        const arg = parsed.message.slice(4).trim();
        if (arg) {
          console.log('[Bot] Ejecutando !pr (pedido por', parsed.sender + '):', arg);
          runOpenclawViaSsh(arg, bot);
        } else {
          const msg = '[pr] Usage: !pr <message>';
          console.log('[Bot] Ejecutando respuesta !pr usage (pedido por', parsed.sender + '):', msg);
          bot.chat(msg);
        }
        return;
      }
      const cmd = lower.slice(1).split(/\s+/)[0];
      if (cmd === 'time') {
        console.log('[Bot] Ejecutando !time (pedido por', parsed.sender + ')');
        const timeOfDay = bot.time?.timeOfDay ?? 0;
        const phase = bot.time?.isDay ? 'Day' : 'Night';
        const pos = bot.entity?.position;
        const posStr = pos ? ` @ (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})` : '';
        const msg = `${phase} (${timeOfDay} ticks)${posStr}`;
        console.log('[Bot] Enviando:', msg);
        bot.chat(msg);
      } else if (cmd === 'players') {
        console.log('[Bot] Ejecutando !players (pedido por', parsed.sender + ')');
        const names = Object.keys(bot.players || {}).filter((n) => n !== bot.username);
        const msg = names.length ? `Online: ${names.join(', ')}` : 'No other players online.';
        console.log('[Bot] Enviando:', msg);
        bot.chat(msg);
      } else if (cmd === 'health' || cmd === 'status') {
        console.log('[Bot] Ejecutando !' + cmd, '(pedido por', parsed.sender + ')');
        const h = bot.health ?? '?';
        const f = bot.food ?? '?';
        const msg = `Health: ${h} | Food: ${f}`;
        console.log('[Bot] Enviando:', msg);
        bot.chat(msg);
      }
    }
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const raw = (typeof message === 'string' ? message : String(message || '')).trim();
    console.log('[Chat] Usuario:', username, '| dijo:', raw);
    const lower = raw.toLowerCase();
    if (lower === 'jarvys ven') {
      const tpaCmd = '/tpa ' + username;
      console.log('[Bot] Ejecutando /tpa (pedido por', username + '):', tpaCmd);
      bot.chat(tpaCmd);
      return;
    }
    if (lower === 'ping') {
      const privCmd = '/msg ' + username + ' pong';
      console.log('[Bot] Ejecutando pong por privado (pedido por', username + '):', privCmd);
      bot.chat(privCmd);
      return;
    }
    if (lower.startsWith('!')) {
      if (lower.startsWith('!pr ')) {
        const arg = raw.slice(4).trim();
        if (arg) {
          console.log('[Bot] Ejecutando !pr (pedido por', username + '):', arg);
          runOpenclawViaSsh(arg, bot);
        } else {
          const msg = '[pr] Usage: !pr <message>';
          console.log('[Bot] Ejecutando respuesta !pr usage (pedido por', username + '):', msg);
          bot.chat(msg);
        }
        return;
      }
      const cmd = lower.slice(1).split(/\s+/)[0];
      if (cmd === 'time') {
        console.log('[Bot] Ejecutando !time (pedido por', username + ')');
        const timeOfDay = bot.time?.timeOfDay ?? 0;
        const phase = bot.time?.isDay ? 'Day' : 'Night';
        const pos = bot.entity?.position;
        const posStr = pos ? ` @ (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})` : '';
        const msg = `${phase} (${timeOfDay} ticks)${posStr}`;
        console.log('[Bot] Enviando:', msg);
        bot.chat(msg);
      } else if (cmd === 'players') {
        console.log('[Bot] Ejecutando !players (pedido por', username + ')');
        const names = Object.keys(bot.players || {}).filter((n) => n !== bot.username);
        const msg = names.length ? `Online: ${names.join(', ')}` : 'No other players online.';
        console.log('[Bot] Enviando:', msg);
        bot.chat(msg);
      } else if (cmd === 'health' || cmd === 'status') {
        console.log('[Bot] Ejecutando !' + cmd, '(pedido por', username + ')');
        const h = bot.health ?? '?';
        const f = bot.food ?? '?';
        const msg = `Health: ${h} | Food: ${f}`;
        console.log('[Bot] Enviando:', msg);
        bot.chat(msg);
      }
    }
  });

  bot.on('kicked', (reason) => {
    console.log('[Bot] Kicked:', reason);
  });

  bot.on('error', (err) => {
    // Ignore protocol PartialReadError for world_particles (server sends malformed particle packets).
    if (err.partialReadError || (err.message && err.message.includes('world_particles'))) return;
    console.error('[Bot] Error:', err.message);
    if (err.stack) console.error('[Bot] Stack:', err.stack);
  });

  bot.on('end', (reason) => {
    console.log('[Bot] Disconnected:', reason || 'unknown');
    console.log(`[Bot] Restarting in ${RESTART_DELAY_MS / 1000}s...`);
    setTimeout(() => { currentBot = createBot(); }, RESTART_DELAY_MS);
  });

  return bot;
}

/** Página del viewer con script que captura teclas (WASD, espacio, flechas, T+Enter chat) y envía por socket.io. */
function getViewerIndexHtml() {
  const lookStep = LOOK_STEP;
  return `<!DOCTYPE html>
<html>
<head>
  <title>Prismarine Viewer</title>
  <style type="text/css">
    html{overflow:hidden}html,body{height:100%;margin:0;padding:0}canvas{height:100%;width:100%;font-size:0;margin:0;padding:0}
    #chat-container{position:fixed;bottom:0;left:0;max-height:200px;width:100%;max-width:400px;background:rgba(0,0,0,0.45);padding:6px 10px;font-size:14px;color:#e0e0e0;font-family:monospace;pointer-events:none;z-index:1000}
    #chat-container.chat-open{pointer-events:auto;max-height:320px}
    #chat-messages{overflow-y:auto;overflow-x:hidden;max-height:180px;word-wrap:break-word}
    #chat-container.chat-open #chat-messages{max-height:280px}
    .chat-msg{margin-bottom:2px;line-height:1.35;text-shadow:0 1px 2px rgba(0,0,0,0.8)}
    .chat-msg.fade-out{opacity:0;transition:opacity 0.5s ease-out}
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="chat-messages"></div>
  </div>
  <script src="/socket.io/socket.io.js"></script>
  <script type="text/javascript" src="index.js"></script>
  <script>
(function(){
  if (typeof io === 'undefined') return;
  var socket = io();
  var lookStep = ${lookStep};
  var keyToControl = { 'KeyW':'forward','KeyS':'back','KeyA':'left','KeyD':'right','Space':'jump' };
  var keyToLook = { 'ArrowUp':[0,lookStep],'ArrowDown':[0,-lookStep],'ArrowLeft':[lookStep,0],'ArrowRight':[-lookStep,0] };
  var sprintOn = false;
  function onKeyDown(e) {
    if (e.repeat) return;
    if (chatInput && document.activeElement === chatInput) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
      sprintOn = !sprintOn;
      socket.emit('control', { key: 'sprint', state: sprintOn ? 'down' : 'up' });
      return;
    }
    var c = keyToControl[e.code];
    if (c) {
      e.preventDefault();
      socket.emit('control', { key: c, state: 'down' });
      return;
    }
    var look = keyToLook[e.code];
    if (look) {
      e.preventDefault();
      socket.emit('look', { dyaw: look[0], dpitch: look[1] });
    }
  }
  function onKeyUp(e) {
    if (chatInput && document.activeElement === chatInput) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return;
    var c = keyToControl[e.code];
    if (c) {
      e.preventDefault();
      socket.emit('control', { key: c, state: 'up' });
    }
  }
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  var chatInput = null;
  var messages = [];
  var maxStored = 50;
  var fadeAfterMs = 5000;
  var chatContainer = document.getElementById('chat-container');
  var chatMessages = document.getElementById('chat-messages');
  function addMessageEl(text) {
    var el = document.createElement('div');
    el.className = 'chat-msg';
    el.textContent = text;
    return el;
  }
  function scrollChatBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  function scheduleFade(el) {
    setTimeout(function() {
      el.classList.add('fade-out');
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
    }, fadeAfterMs);
  }
  function renderHistory(count, shouldFade) {
    chatMessages.innerHTML = '';
    var start = Math.max(0, messages.length - count);
    for (var i = start; i < messages.length; i++) {
      var el = addMessageEl(messages[i]);
      chatMessages.appendChild(el);
      if (shouldFade) scheduleFade(el);
    }
    scrollChatBottom();
  }
  socket.on('gameChat', function(msg) {
    var text = (typeof msg === 'string' ? msg : String(msg || '')).trim();
    if (!text) return;
    messages.push(text);
    if (messages.length > maxStored) messages.shift();
    if (chatInput && document.activeElement === chatInput) {
      renderHistory(20, false);
      return;
    }
    var el = addMessageEl(text);
    chatMessages.appendChild(el);
    scrollChatBottom();
    scheduleFade(el);
  });
  document.addEventListener('keydown', function(e) {
    if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (chatInput && document.activeElement === chatInput) return;
      e.preventDefault();
      if (!chatInput) {
        ['forward','back','left','right','jump'].forEach(function(k){ socket.emit('control', { key: k, state: 'up' }); });
        chatContainer.classList.add('chat-open');
        renderHistory(20, false);
        chatInput = document.createElement('input');
        chatInput.type = 'text';
        chatInput.placeholder = 'Chat...';
        chatInput.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:8px;font-size:14px;z-index:9999;border:1px solid #333;background:rgba(0,0,0,0.7);color:#fff';
        chatInput.onkeydown = function(ev) {
          if (ev.code === 'Enter') {
            var msg = chatInput.value.trim();
            if (msg) socket.emit('chat', msg);
            chatInput.value = '';
            chatInput.remove();
            chatInput = null;
            chatContainer.classList.remove('chat-open');
            renderHistory(5, true);
          }
          if (ev.code === 'Escape') {
            chatInput.remove();
            chatInput = null;
            chatContainer.classList.remove('chat-open');
            renderHistory(5, true);
          }
        };
        document.body.appendChild(chatInput);
        chatInput.focus();
      }
    }
  }, true);
})();
  </script>
</body>
</html>`;
}

/** Servidor del viewer (puerto VIEWER_PORT) con controles por teclado en la misma página. Replica lógica de prismarine-viewer y añade eventos control/chat/look. */
function startViewerWithControls(bot, controls) {
  const viewDistance = 6;
  const prefix = '';
  const app = express();
  const server = http.createServer(app);
  const io = require('socket.io')(server, { path: prefix + '/socket.io' });

  app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(getViewerIndexHtml());
  });
  setupRoutes(app, prefix);

  const sockets = [];
  const primitives = {};
  function broadcastGameChat(msg) {
    const text = (typeof msg === 'string' ? msg : String(msg || '')).trim();
    if (text) {
      for (const s of sockets) s.emit('gameChat', text);
    }
  }
  const onGameMessage = (msg) => broadcastGameChat(msg);
  bot.on('messagestr', onGameMessage);
  bot.viewer = new EventEmitter();
  bot.viewer.erase = (id) => {
    delete primitives[id];
    for (const s of sockets) s.emit('primitive', { id });
  };
  bot.viewer.drawBoxGrid = (id, start, end, color = 'aqua') => {
    primitives[id] = { type: 'boxgrid', id, start, end, color };
    for (const s of sockets) s.emit('primitive', primitives[id]);
  };
  bot.viewer.drawLine = (id, points, color = 0xff0000) => {
    primitives[id] = { type: 'line', id, points, color };
    for (const s of sockets) s.emit('primitive', primitives[id]);
  };
  bot.viewer.drawPoints = (id, points, color = 0xff0000, size = 5) => {
    primitives[id] = { type: 'points', id, points, color, size };
    for (const s of sockets) s.emit('primitive', primitives[id]);
  };

  const validKeys = ['forward', 'back', 'left', 'right', 'jump', 'sprint'];
  io.on('connection', (socket) => {
    socket.emit('version', bot.version);
    sockets.push(socket);

    const worldView = new WorldView(bot.world, viewDistance, bot.entity.position, socket);
    worldView.init(bot.entity.position);
    worldView.on('blockClicked', (block, face, button) => {
      bot.viewer.emit('blockClicked', block, face, button);
    });
    for (const id in primitives) socket.emit('primitive', primitives[id]);

    function botPosition() {
      const packet = { pos: bot.entity.position, yaw: bot.entity.yaw, addMesh: true };
      if (VIEWER_FIRST_PERSON) packet.pitch = bot.entity.pitch;
      socket.emit('position', packet);
      worldView.updatePosition(bot.entity.position);
    }
    bot.on('move', botPosition);
    worldView.listenToBot(bot);

    socket.on('control', (data) => {
      if (!data || !validKeys.includes(data.key)) return;
      controls.setControl(data.key, data.state === 'down');
    });
    socket.on('look', (data) => {
      if (data && Number.isFinite(data.dyaw) && Number.isFinite(data.dpitch)) {
        controls.adjustLook(Number(data.dyaw), Number(data.dpitch));
      }
    });
    socket.on('chat', (msg) => {
      const text = (typeof msg === 'string' ? msg : '').trim().slice(0, MAX_CHAT_LEN);
      if (text && currentBot) {
        try {
          currentBot.chat(text);
        } catch (e) {
          console.error('[Viewer] Chat error:', e.message);
        }
      }
    });

    socket.on('disconnect', () => {
      bot.removeListener('move', botPosition);
      worldView.removeListenersFromBot(bot);
      sockets.splice(sockets.indexOf(socket), 1);
    });
  });

  server.listen(VIEWER_PORT, () => {
    console.log('Prismarine viewer web server running on *:' + VIEWER_PORT);
  });
  bot.viewer.close = () => {
    bot.removeListener('messagestr', onGameMessage);
    server.close();
    for (const s of sockets) s.disconnect();
  };
}

/** Servidor TCP: cada línea recibida se envía al chat del juego. Opcionalmente abre una segunda terminal con el cliente. */
function setupChatServer() {
  const server = net.createServer((socket) => {
    let buf = '';
    socket.setEncoding('utf8');
    socket.on('data', (data) => {
      buf += data;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || '';
      for (const line of lines) {
        const msg = line.trim();
        if (msg && currentBot) {
          try {
            currentBot.chat(msg);
            console.log('[Chat] Enviado:', msg);
          } catch (e) {
            console.error('[Chat] Error:', e.message);
          }
        }
      }
    });
    socket.on('error', () => {});
  });
  server.listen(CHAT_SERVER_PORT, '127.0.0.1', () => {
    const port = server.address().port;
    console.log('[Chat] Servidor en 127.0.0.1:' + port + ' (escribe en la otra terminal o: CHAT_PORT=' + port + ' node chat-client.js)');
    if (SPAWN_CHAT_TERMINAL && process.stdin.isTTY) {
      const script = path.join(__dirname, 'chat-client.js');
      const env = { ...process.env, CHAT_PORT: String(port) };
      if (CHAT_TERMINAL === 'gnome-terminal') {
        spawn('gnome-terminal', ['--', process.execPath, script], { env, detached: true }).on('error', () => {
          console.log('[Chat] gnome-terminal no disponible. Abre otra terminal y ejecuta: CHAT_PORT=' + port + ' node chat-client.js');
        });
      } else if (CHAT_TERMINAL === 'xterm') {
        spawn('xterm', ['-e', process.execPath + ' ' + script], { env, detached: true, shell: true }).on('error', () => {
          console.log('[Chat] xterm no disponible. Ejecuta en otra terminal: CHAT_PORT=' + port + ' node chat-client.js');
        });
      } else {
        spawn(CHAT_TERMINAL, ['--', process.execPath, script], { env, detached: true }).on('error', () => {
          console.log('[Chat] Ejecuta en otra terminal: CHAT_PORT=' + port + ' node chat-client.js');
        });
      }
    }
  });
}

/** Servidor TCP de comandos: cada línea es un comando (list, health, pos, help). Responde al cliente. */
function setupCommandServer() {
  function runCommand(cmd) {
    if (!currentBot) return 'Bot no conectado.';
    const c = cmd.trim().toLowerCase();
    try {
      if (c === 'list' || c === 'players') {
        const names = Object.keys(currentBot.players || {}).filter((n) => n !== currentBot.username);
        return names.length ? names.join(', ') : 'Nadie más conectado.';
      }
      if (c === 'health' || c === 'status') {
        const h = currentBot.health ?? '?';
        const f = currentBot.food ?? '?';
        return `Vida: ${h} | Comida: ${f}`;
      }
      if (c === 'pos' || c === 'position') {
        const p = currentBot.entity?.position;
        if (!p) return 'Sin posición.';
        return `${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}`;
      }
      if (c === 'help' || c === '?') {
        return 'Comandos: list | health | pos | help';
      }
      return 'Comando desconocido. Escribe help.';
    } catch (e) {
      return 'Error: ' + (e.message || e);
    }
  }

  const server = net.createServer((socket) => {
    let buf = '';
    socket.setEncoding('utf8');
    socket.on('data', (data) => {
      buf += data;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || '';
      for (const line of lines) {
        const response = runCommand(line);
        socket.write(response + '\n');
      }
    });
    socket.on('error', () => {});
  });
  server.listen(COMMAND_SERVER_PORT, '127.0.0.1', () => {
    const port = server.address().port;
    console.log('[Cmd] Servidor en 127.0.0.1:' + port + ' (otra terminal: COMMAND_PORT=' + port + ' node command-client.js)');
    if (SPAWN_COMMAND_TERMINAL && process.stdin.isTTY) {
      const script = path.join(__dirname, 'command-client.js');
      const env = { ...process.env, COMMAND_PORT: String(port) };
      if (COMMAND_TERMINAL === 'gnome-terminal') {
        spawn('gnome-terminal', ['--', process.execPath, script], { env, detached: true }).on('error', () => {
          console.log('[Cmd] gnome-terminal no disponible. Ejecuta: COMMAND_PORT=' + port + ' node command-client.js');
        });
      } else if (COMMAND_TERMINAL === 'xterm') {
        spawn('xterm', ['-e', process.execPath + ' ' + script], { env, detached: true, shell: true }).on('error', () => {
          console.log('[Cmd] xterm no disponible. Ejecuta: COMMAND_PORT=' + port + ' node command-client.js');
        });
      } else {
        spawn(COMMAND_TERMINAL, ['--', process.execPath, script], { env, detached: true }).on('error', () => {
          console.log('[Cmd] Ejecuta: COMMAND_PORT=' + port + ' node command-client.js');
        });
      }
    }
  });
}

/** Controles compartidos: setControl, holdControl, releaseControl, adjustLook. Usados por CLI (stdin) o por web. */
function setupMovementControls() {
  const HOLD_RELEASE_MS = 120;
  const releaseTimers = { forward: null, back: null, left: null, right: null, jump: null };

  function setControl(name, value) {
    if (!currentBot || !currentBot.entity) return;
    try {
      currentBot.setControlState(name, value);
    } catch (e) {}
  }

  function holdControl(name) {
    setControl(name, true);
    if (releaseTimers[name]) clearTimeout(releaseTimers[name]);
    releaseTimers[name] = setTimeout(() => {
      setControl(name, false);
      releaseTimers[name] = null;
    }, HOLD_RELEASE_MS);
  }

  function releaseControl(name) {
    if (releaseTimers[name]) {
      clearTimeout(releaseTimers[name]);
      releaseTimers[name] = null;
    }
    setControl(name, false);
  }

  function adjustLook(dyaw, dpitch) {
    if (!currentBot || !currentBot.entity) return;
    const entity = currentBot.entity;
    const yaw = (entity.yaw ?? 0) + dyaw;
    const pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (entity.pitch ?? 0) + dpitch));
    try {
      currentBot.look(yaw, pitch, true);
    } catch (e) {}
  }

  return { setControl, holdControl, releaseControl, adjustLook };
}

/** Raw mode por terminal: WASD + espacio + flechas. Solo si STDIN_CONTROLS=1. Controles por defecto en la página del viewer. */
function setupCliInput() {
  const controls = setupMovementControls();
  viewerMovementControls = controls;
  const { holdControl, adjustLook } = controls;

  if (!USE_STDIN_CONTROLS) {
    process.on('SIGINT', () => process.exit());
    if (VIEWER_ENABLED) {
      console.log('[CLI] Controles en la página del viewer (http://localhost:' + VIEWER_PORT + '). Ctrl+C = salir.');
    } else {
      console.log('[CLI] Sin viewer ni stdin. Ctrl+C = salir.');
    }
    return;
  }

  function isCtrlC(key) {
    if (Buffer.isBuffer(key)) return key.length >= 1 && key[0] === 3;
    if (typeof key === 'string') return key.length >= 1 && key.charCodeAt(0) === 3;
    return false;
  }
  function isArrowUp(key) { return key === '\x1b[A' || key === '\x1bOA'; }
  function isArrowDown(key) { return key === '\x1b[B' || key === '\x1bOB'; }
  function isArrowRight(key) { return key === '\x1b[C' || key === '\x1bOC'; }
  function isArrowLeft(key) { return key === '\x1b[D' || key === '\x1bOD'; }

  function onKey(key) {
    if (isCtrlC(key)) {
      process.exit();
      return;
    }
    if (Buffer.isBuffer(key)) key = key.toString('utf8');
    else if (typeof key !== 'string') return;
    if (isArrowUp(key)) { adjustLook(0, LOOK_STEP); return; }
    if (isArrowDown(key)) { adjustLook(0, -LOOK_STEP); return; }
    if (isArrowLeft(key)) { adjustLook(LOOK_STEP, 0); return; }
    if (isArrowRight(key)) { adjustLook(-LOOK_STEP, 0); return; }
    const c = (typeof key === 'string' && key.length >= 1) ? key[0].toLowerCase() : '';
    if (c === 'w') holdControl('forward');
    else if (c === 's') holdControl('back');
    else if (c === 'a') holdControl('left');
    else if (c === 'd') holdControl('right');
    else if (key === ' ') holdControl('jump');
  }

  process.on('SIGINT', () => process.exit());
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onKey);
    console.log('[CLI] Controles terminal: WASD/espacio | ↑↓←→ | Ctrl+C = salir');
  } else {
    console.log('[CLI] stdin no es TTY. Usa la web o Ctrl+C para salir.');
  }
}

currentBot = createBot();
setupChatServer();
setupCommandServer();
setupCliInput();
