const fs = require('fs');
const path = require('path');
const { useMultiFileAuthState } = require('baileys');
const config = require('./config');
const sessionDb = require('./db/session');
const { createLogger } = require('./logger');

const logger = createLogger('auth');

function authDir(sessionId) {
  return path.join(config.sessionsDir, sessionId);
}

/**
 * Um pareamento que foi iniciado mas nunca concluído deixa creds.me
 * gravado sem creds.registered. Nesse estado o Baileys passa a enviar um
 * nó de login (em vez de registro) para um aparelho que o WhatsApp não
 * conhece, e toda conexão seguinte é rejeitada com 401 — travando a
 * sessão para sempre. Como essas credenciais nunca chegaram a autenticar,
 * elas não têm valor nenhum e podem ser descartadas com segurança.
 */
function isIncompletePairing(creds) {
  return !!creds?.me && !creds?.registered;
}

/**
 * Carrega (ou cria) as credenciais de autenticação de uma sessão,
 * isoladas em sessions/<sessionId>/, e registra a sessão no banco local.
 */
async function getAuthState(sessionId) {
  sessionDb.add(sessionId);
  const dir = authDir(sessionId);

  let { state, saveCreds } = await useMultiFileAuthState(dir);
  let reset = false;

  if (isIncompletePairing(state.creds)) {
    logger.warn({ sessionId }, 'Discarding incomplete pairing credentials');
    console.log(
      `♻️  [${sessionId}] Credenciais de um pareamento incompleto encontradas em sessions/${sessionId} — descartando para começar do zero.`,
    );
    fs.rmSync(dir, { recursive: true, force: true });
    ({ state, saveCreds } = await useMultiFileAuthState(dir));
    reset = true;
  }

  // "reset" avisa quem chamou que as chaves anteriores foram descartadas —
  // um código de pareamento gerado antes disso não vale mais.
  return { state, saveCreds, reset };
}

module.exports = { getAuthState, authDir };
