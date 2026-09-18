const { createLogger } = require('../utils/logger');

const logger = createLogger('autoRead');

/**
 * Marks an incoming message as read (blue double check).
 */
async function markAsRead(sock, key) {
  try {
    await sock.readMessages([key]);
  } catch (err) {
    logger.warn({ err }, 'Could not mark message as read');
  }
}

module.exports = { markAsRead };
