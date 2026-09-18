const config = require('./config');
const { createLogger } = require('./logger');
const { getAuthState } = require('./auth');
const { createSocket } = require('./baileys');
const { bindEvents } = require('./events');

const logger = createLogger('client');
const sessions = new Map();

// Sessões para as quais já pedimos um código de pareamento nesta execução
// do processo. O WhatsApp sempre derruba a conexão logo depois de emitir
// o código (isso é esperado, não um erro) — sem essa guarda, cada
// reconexão automática pediria um código novo, num loop que nunca dá
// tempo de digitar nenhum deles no celular. Reiniciar o processo (ex.:
// Ctrl+C + npm start) limpa essa guarda e permite gerar um código novo.
const pairingRequested = new Set();

/**
 * Solicita o código de pareamento assim que o WebSocket com o WhatsApp
 * estiver de fato aberto (chamar requestPairingCode antes disso falha
 * imediatamente com "Connection Closed" — daí usarmos waitForSocketOpen
 * em vez de um setTimeout arbitrário).
 */
async function requestPairingCode(sock, sessionId) {
  const number = config.pairingNumber.replace(/\D/g, '');
  if (!number) {
    throw new Error('PAIRING_NUMBER não está definido (ou não contém dígitos) no .env/config.json.');
  }

  console.log(`⏳ [${sessionId}] Conectando ao WhatsApp para gerar o código de pareamento...`);
  await sock.waitForSocketOpen();

  const code = await sock.requestPairingCode(number);
  console.log(`\n📟 [${sessionId}] Código de pareamento: ${code}\n`);
  console.log('No celular: Aparelhos conectados > Conectar um aparelho > Conectar com número de telefone.');
}

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

  if (config.loginMethod === 'pairing' && !sock.authState.creds.registered) {
    if (!pairingRequested.has(sessionId)) {
      pairingRequested.add(sessionId);
      requestPairingCode(sock, sessionId).catch((err) => {
        pairingRequested.delete(sessionId);
        logger.error({ err }, 'Failed to request pairing code');
        console.error(`❌ [${sessionId}] Não foi possível gerar o código de pareamento: ${err.message}`);
      });
    } else {
      console.log(`⏳ [${sessionId}] Aguardando o código de pareamento já gerado ser inserido no celular...`);
    }
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
