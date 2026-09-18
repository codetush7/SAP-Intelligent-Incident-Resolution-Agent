const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) { return path.join(DATA_DIR, `${name}.json`); }

function load(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') logger.error(`[FileStore] Failed to read ${name}.json: ${err.message}`);
    return fallback;
  }
}

function save(name, data) {
  try {
    fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error(`[FileStore] Failed to write ${name}.json: ${err.message}`);
  }
}

module.exports = { load, save };