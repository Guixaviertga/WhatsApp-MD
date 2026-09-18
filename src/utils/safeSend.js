const { createLogger } = require('./logger');

const logger = createLogger('safeSend');
const RETRY_DELAY_MS = 1500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a WhatsApp message, retrying once after a short delay if the first
 * attempt fails. On unstable mobile connections (e.g. Termux over 4G), the
 * Signal session with a contact can still be mid-handshake right after
 * connecting, causing a transient "No sessions" / timeout error that
 * normally succeeds on the very next try.
 */
async function sendWithRetry(sock, jid, content, options) {
  try {
    return await sock.sendMessage(jid, content, options);
  } catch (err) {
    logger.warn({ err, jid }, 'sendMessage failed, retrying once');
    await wait(RETRY_DELAY_MS);
    try {
      return await sock.sendMessage(jid, content, options);
    } catch (err2) {
      logger.error({ err: err2, jid }, 'sendMessage failed again, giving up');
      return null;
    }
  }
}

module.exports = { sendWithRetry };
