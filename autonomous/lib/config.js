'use strict';

/**
 * Connection: .env only (see .env.example). Tuning defaults: config/default.yml (+ optional config/local.yml).
 * VERSION=latest → 1.21.11.
 */
require('./loadRuntimeConfig').init();

const DEFAULT_VERSION = '1.21.11';

function getConfig() {
  const name = process.env.NAME || process.env.MC_USERNAME;
  const host = process.env.SERVER_IP || process.env.MC_HOST || 'localhost';
  const port = parseInt(process.env.PORT || process.env.MC_PORT || '25565', 10);
  let version = process.env.VERSION || process.env.MC_VERSION || DEFAULT_VERSION;
  if (version === 'latest') version = DEFAULT_VERSION;
  const auth = process.env.MC_AUTH || 'offline';

  if (!name) {
    console.error('[Config] Set NAME or MC_USERNAME in autonomous/.env (see .env.example)');
    process.exit(1);
  }

  return { host, port, username: name, version, auth };
}

module.exports = { getConfig };
