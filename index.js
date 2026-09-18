const config = require('./config');
const client = require('./lib/client');
const { startApi } = require('./lib/api');
const { createLogger } = require('./lib/logger');

const logger = createLogger('bootstrap');

async function main() {
  logger.info(
    { sessions: config.sessionIds, language: config.defaultLanguage },
    'Iniciando Levanter-MD',
  );

  await client.startAll();
  startApi();

  process.on('SIGINT', () => {
    logger.info('Encerrando Levanter-MD...');
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Falha ao iniciar o bot');
  process.exit(1);
});
