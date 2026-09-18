const { createLogger } = require('./logger');

const logger = createLogger('sendMessage');
const RETRY_DELAY_MS = 1500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia uma mensagem de WhatsApp, tentando novamente uma vez após um
 * pequeno atraso se a primeira tentativa falhar. Em conexões móveis
 * instáveis (ex.: Termux via 4G), a sessão de criptografia (Signal) com um
 * contato pode ainda estar em handshake logo após conectar, causando um
 * erro transitório de "No sessions"/timeout que normalmente funciona na
 * tentativa seguinte.
 */
async function sendWithRetry(sock, jid, content, options) {
  try {
    return await sock.sendMessage(jid, content, options);
  } catch (err) {
    logger.warn({ err, jid }, 'envio falhou, tentando de novo');
    await wait(RETRY_DELAY_MS);
    try {
      return await sock.sendMessage(jid, content, options);
    } catch (err2) {
      logger.error({ err: err2, jid }, 'envio falhou de novo, desistindo');
      return null;
    }
  }
}

module.exports = { sendWithRetry };
