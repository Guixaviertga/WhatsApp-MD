const path = require('path');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const config = require('./config');
const sessionDb = require('./db/session');

function authDir(sessionId) {
  return path.join(config.sessionsDir, sessionId);
}

/**
 * Carrega (ou cria) as credenciais de autenticação de uma sessão,
 * isoladas em sessions/<sessionId>/, e registra a sessão no banco local.
 */
async function getAuthState(sessionId) {
  sessionDb.add(sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir(sessionId));
  return { state, saveCreds };
}

module.exports = { getAuthState, authDir };
