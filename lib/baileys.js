const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { createLogger } = require('./logger');
const Store = require('./store');

/**
 * Integração de baixo nível com o Baileys: cria o socket de uma sessão
 * com as opções ajustadas para redes móveis instáveis (Termux/4G).
 */
async function createSocket({ sessionId, state }) {
  const { version } = await fetchLatestBaileysVersion();
  const logger = createLogger(`baileys:${sessionId}`);
  const store = new Store();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: [`Levanter-MD (${sessionId})`, 'Chrome', '1.0.0'],
    // Conexões móveis costumam ser mais lentas/instáveis que uma rede de
    // servidor; timeouts maiores evitam que a sincronização inicial (e o
    // estabelecimento da sessão de criptografia com cada contato) falhe
    // prematuramente por "Timed Out".
    defaultQueryTimeoutMs: 120_000,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    // Não precisamos do histórico completo de conversas para um bot de
    // respostas automáticas — pular essa sincronização deixa a conexão
    // inicial mais leve e rápida em redes ruins.
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  store.bind(sock);
  sock.store = store;

  return sock;
}

module.exports = { createSocket };
