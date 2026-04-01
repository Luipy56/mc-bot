'use strict';

/**
 * Load order:
 * 1) dotenv from .env — secrets and connection (see .env.example)
 * 2) config/default.yml — non-sensitive defaults (optional config/local.yml merges on top)
 *
 * Only sets process.env[key] when the key is missing (undefined), so .env always wins.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.join(__dirname, '..');

function envValueToString(v) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v === null || v === undefined) return '';
  return String(v);
}

function mergeYamlFiles() {
  const defPath = path.join(ROOT, 'config', 'default.yml');
  const localPath = path.join(ROOT, 'config', 'local.yml');
  let data = {};
  if (fs.existsSync(defPath)) {
    const raw = fs.readFileSync(defPath, 'utf8');
    const parsed = yaml.parse(raw);
    if (parsed && typeof parsed === 'object') data = { ...parsed };
  }
  if (fs.existsSync(localPath)) {
    const raw = fs.readFileSync(localPath, 'utf8');
    const parsed = yaml.parse(raw);
    if (parsed && typeof parsed === 'object') {
      data = { ...data, ...parsed };
    }
  }
  return data;
}

function applyYamlDefaults() {
  const data = mergeYamlFiles();
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (process.env[k] !== undefined) continue;
    process.env[k] = envValueToString(v);
  }
}

function loadDotenv() {
  require('dotenv').config({ path: path.join(ROOT, '.env') });
}

/**
 * Call once at process startup (before reading tuning from process.env).
 */
function init() {
  loadDotenv();
  applyYamlDefaults();
}

module.exports = { init, loadDotenv, applyYamlDefaults, mergeYamlFiles };
