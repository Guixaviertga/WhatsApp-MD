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

  // Aviso visível (não só no log JSON) com a configuração de login
  // realmente carregada — ajuda a diagnosticar rapidamente quando o
  // .env/config.json editado não é o que o processo está lendo.
  console.log(`\n🔧 Método de login: ${config.loginMethod}`);
  console.log(`🔧 Sessões: ${config.sessionIds.join(', ')}`);

  if (config.loginMethod === 'pairing') {
    for (const sessionId of config.sessionIds) {
      const number = config.pairingNumbers[sessionId];
      console.log(
        number
          ? `🔧 Pareamento de "${sessionId}": ${number}`
          : `⚠️  Sessão "${sessionId}" sem número — defina PAIRING_NUMBERS=${sessionId}:5511999999999`,
      );
    }
  }
  console.log('');

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
