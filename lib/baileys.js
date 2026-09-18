const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  Browsers,
} = require('baileys');
const { createBaileysLogger, createLogger } = require('./logger');
const Store = require('./store');

let cachedVersion = null;

/**
 * Versão do WhatsApp Web, buscada uma vez por execução.
 *
 * Sem o cache, cada reconexão fazia uma requisição ao GitHub antes de
 * tentar conectar — justamente quando a rede costuma estar ruim, que é o
 * motivo da reconexão.
 */
async function getVersion() {
  if (cachedVersion) return cachedVersion;

  const { version, isLatest } = await fetchLatestBaileysVersion();
  cachedVersion = version;
  createLogger('baileys').info({ versao: version.join('.'), atual: isLatest }, 'versão do WhatsApp Web');
  return cachedVersion;
}

/**
 * Integração de baixo nível com o Baileys: cria o socket de uma sessão
 * com as opções ajustadas para redes móveis instáveis (Termux/4G).
 */
async function createSocket({ sessionId, state }) {
  const version = await getVersion();
  const logger = createBaileysLogger(sessionId);
  const store = new Store();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    // O WhatsApp valida esses valores no registro de aparelho companheiro;
    // um "browser" fora do padrão faz o pareamento por código ser recusado.
    // Por isso usamos um perfil reconhecido em vez de um nome próprio.
    browser: Browsers.ubuntu('Chrome'),
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
