const config = require('./config');
const { createLogger } = require('./logger');
const { getAuthState } = require('./auth');
const { createSocket } = require('./baileys');
const { bindEvents } = require('./events');

const logger = createLogger('client');
const sessions = new Map();

/**
 * Inicia (ou reinicia, em caso de reconexão) uma sessão do WhatsApp
 * completamente isolada: credenciais, socket e handlers próprios.
 */
async function startSession(sessionId) {
  logger.info(`Iniciando sessão "${sessionId}"...`);

  const { state, saveCreds } = await getAuthState(sessionId);
  const sock = await createSocket({ sessionId, state });

  sock.ev.on('creds.update', saveCreds);

  bindEvents(sock, {
    sessionId,
    logger: logger.child({ session: sessionId }),
    onReconnect: () => startSession(sessionId).catch((err) => {
      logger.error({ err, sessionId }, 'Reconnect failed');
    }),
  });

  if (config.loginMethod === 'pairing' && config.pairingNumber && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.pairingNumber);
        console.log(`\n📟 [${sessionId}] Código de pareamento: ${code}\n`);
      } catch (err) {
        logger.error({ err }, 'Failed to request pairing code');
      }
    }, 3000);
  }

  sessions.set(sessionId, sock);
  return sock;
}

async function startAll() {
  if (config.sessionIds.length === 0) {
    logger.warn('Nenhuma sessão configurada em SESSION_IDS. Nada para iniciar.');
    return;
  }
  for (const sessionId of config.sessionIds) {
    await startSession(sessionId);
  }
}

function get(sessionId) {
  return sessions.get(sessionId);
}

function all() {
  return [...sessions.values()];
}

module.exports = { startAll, startSession, get, all };
