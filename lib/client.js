const config = require('./config');
const { createLogger } = require('./logger');
const { getAuthState } = require('./auth');
const { createSocket } = require('./baileys');
const { bindEvents } = require('./events');

const logger = createLogger('client');
const sessions = new Map();

const RECONNECT_DELAY_MS = 3000;

// Sessões para as quais já pedimos um código de pareamento. O evento
// "qr" se repete a cada poucos segundos enquanto ninguém pareia; sem esta
// guarda, cada repetição geraria um código novo e nunca daria tempo de
// digitar nenhum deles no celular.
const pairingRequested = new Set();

/**
 * Solicita o código de pareamento. Só deve ser chamada depois que o
 * servidor sinalizou que está pronto para parear (primeiro evento "qr"),
 * porque requestPairingCode grava creds.me — e, se isso acontecer antes
 * do handshake, o Baileys passa a enviar um nó de login em vez de
 * registro, para um aparelho que ainda não existe.
 */
async function requestPairingCode(sock, sessionId) {
  const number = config.pairingNumber.replace(/\D/g, '');
  if (!number) {
    throw new Error('PAIRING_NUMBER não está definido (ou não contém dígitos) no .env/config.json.');
  }

  const code = await sock.requestPairingCode(number);
  console.log(`\n📟 [${sessionId}] Código de pareamento: ${code}\n`);
  console.log('No celular: Aparelhos conectados > Conectar um aparelho > Conectar com número de telefone.\n');
}

/**
 * Inicia (ou reinicia, em caso de reconexão) uma sessão do WhatsApp
 * completamente isolada: credenciais, socket e handlers próprios.
 */
async function startSession(sessionId) {
  logger.info(`Iniciando sessão "${sessionId}"...`);

  const { state, saveCreds, reset } = await getAuthState(sessionId);

  // Se as credenciais foram descartadas, o código de pareamento anterior
  // morreu junto com as chaves — é preciso gerar um novo.
  if (reset) pairingRequested.delete(sessionId);

  const sock = await createSocket({ sessionId, state });

  sock.ev.on('creds.update', saveCreds);

  bindEvents(sock, {
    sessionId,
    logger: logger.child({ session: sessionId }),
    onReconnect: () => {
      // Uma pausa antes de reconectar evita o giro em loop apertado que
      // aparecia quando o WhatsApp derrubava a conexão repetidamente.
      setTimeout(() => {
        startSession(sessionId).catch((err) => {
          logger.error({ err, sessionId }, 'Reconnect failed');
        });
      }, RECONNECT_DELAY_MS);
    },
    onPairingReady: () => {
      if (sock.authState.creds.registered || pairingRequested.has(sessionId)) return;
      pairingRequested.add(sessionId);
      requestPairingCode(sock, sessionId).catch((err) => {
        pairingRequested.delete(sessionId);
        logger.error({ err }, 'Failed to request pairing code');
        console.error(`❌ [${sessionId}] Não foi possível gerar o código de pareamento: ${err.message}`);
      });
    },
  });

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
