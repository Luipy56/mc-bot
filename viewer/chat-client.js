#!/usr/bin/env node
'use strict';

/**
 * Cliente de terminal para enviar mensajes al bot.
 * Se ejecuta en una segunda terminal; cada línea que escribas se envía al chat del juego.
 * Conectar: el bot arranca un servidor TCP y abre esta terminal automáticamente.
 */

const net = require('net');
const readline = require('readline');

const port = parseInt(process.env.CHAT_PORT || process.argv[2] || '0', 10);
if (!port) {
  console.error('Uso: node chat-client.js <puerto>');
  process.exit(1);
}

const socket = net.createConnection(port, '127.0.0.1', () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('chat> ');
  rl.prompt();
  rl.on('line', (line) => {
    const msg = line.trim();
    if (msg) socket.write(msg + '\n');
    rl.prompt();
  });
  rl.on('close', () => {
    socket.end();
  });
  socket.on('close', () => {
    rl.close();
    process.exit(0);
  });
  socket.on('error', (err) => {
    console.error(err.message);
    process.exit(1);
  });
});

socket.on('error', (err) => {
  console.error('No se pudo conectar al bot:', err.message);
  process.exit(1);
});
