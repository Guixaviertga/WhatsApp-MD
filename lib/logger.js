const pino = require('pino');
const config = require('./config');

function createLogger(name) {
  return pino({ level: config.logLevel, name }).child({ module: name });
}

module.exports = { createLogger };
