#!/usr/bin/env node
'use strict';

/**
 * Cliente de terminal para mandar comandos al bot (list, health, pos, help...).
 * El bot ejecuta el comando y envía la respuesta a esta terminal.
 */

const net = require('net');
const readline = require('readline');

const port = parseInt(process.env.COMMAND_PORT || process.argv[2] || '0', 10);
if (!port) {
  console.error('Uso: node command-client.js <puerto> o COMMAND_PORT=<puerto> node command-client.js');
  process.exit(1);
}

const socket = net.createConnection(port, '127.0.0.1', () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('cmd> ');
  rl.prompt();

  socket.setEncoding('utf8');
  let buf = '';
  socket.on('data', (data) => {
    buf += data;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) console.log(line);
    }
    rl.prompt();
  });

  rl.on('line', (line) => {
    const cmd = line.trim();
    if (cmd) socket.write(cmd + '\n');
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
