const { createLogger } = require('../utils/logger');
const config = require('../config/env');
const i18n = require('../i18n');

const logger = createLogger('autoRejectCall');

/**
 * Registers a listener that automatically rejects incoming voice/video
 * calls and, optionally, notifies the caller with a text message.
 */
function registerAutoRejectCall(sock) {
  if (!config.autoRejectCalls) return;

  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status !== 'offer') continue;

      try {
        await sock.rejectCall(call.id, call.from);
        logger.info({ from: call.from }, 'Rejected incoming call');

        if (config.callRejectMessageKey) {
          const text = i18n.t(call.from, config.callRejectMessageKey);
          await sock.sendMessage(call.from, { text });
        }
      } catch (err) {
        logger.error({ err }, 'Failed to reject call');
      }
    }
  });
}

module.exports = { registerAutoRejectCall };
