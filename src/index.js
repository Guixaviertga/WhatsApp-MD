const config = require('./config/env');
const SessionManager = require('./core/SessionManager');
const { createLogger } = require('./utils/logger');

const logger = createLogger('bootstrap');

async function main() {
  logger.info(
    { sessions: config.sessionIds, language: config.defaultLanguage },
    'Iniciando WhatsApp-MD',
  );

  const manager = new SessionManager();
  await manager.startAll();

  process.on('SIGINT', () => {
    logger.info('Encerrando WhatsApp-MD...');
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Falha ao iniciar o bot');
  process.exit(1);
});
