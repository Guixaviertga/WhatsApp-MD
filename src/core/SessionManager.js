const Session = require('./Session');
const config = require('../config/env');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SessionManager');

/**
 * Boots and keeps track of every configured WhatsApp session, each one
 * fully independent (own auth folder, own socket, own event handlers),
 * so multiple accounts can be managed at the same time.
 */
class SessionManager {
  constructor(sessionIds = config.sessionIds) {
    this.sessionIds = sessionIds;
    this.sessions = new Map();
  }

  async startAll() {
    if (this.sessionIds.length === 0) {
      logger.warn('Nenhuma sessão configurada em SESSION_IDS. Nada para iniciar.');
      return;
    }

    for (const sessionId of this.sessionIds) {
      await this.startSession(sessionId);
    }
  }

  async startSession(sessionId) {
    logger.info(`Iniciando sessão "${sessionId}"...`);
    const session = new Session(sessionId);
    await session.start();
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId) {
    return this.sessions.get(sessionId);
  }

  all() {
    return [...this.sessions.values()];
  }
}

module.exports = SessionManager;
