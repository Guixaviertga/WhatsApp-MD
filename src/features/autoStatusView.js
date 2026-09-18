const { createLogger } = require('../utils/logger');
const config = require('../config/env');

const logger = createLogger('autoStatusView');

const STATUS_JID = 'status@broadcast';

function isStatusMessage(message) {
  return message?.key?.remoteJid === STATUS_JID;
}

/**
 * Marks a status update as viewed and, optionally, reacts to it.
 */
async function handleStatus(sock, message) {
  if (!isStatusMessage(message)) return;

  try {
    await sock.readMessages([message.key]);
  } catch (err) {
    logger.warn({ err }, 'Could not mark status as viewed');
    return;
  }

  if (config.autoReactStatus) {
    try {
      await sock.sendMessage(
        STATUS_JID,
        { react: { text: '❤️', key: message.key } },
        { statusJidList: [message.key.participant].filter(Boolean) },
      );
    } catch (err) {
      logger.warn({ err }, 'Could not react to status');
    }
  }
}

module.exports = { handleStatus, isStatusMessage };
