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
  if (config.loginMethod === 'pairing') {
    console.log(
      config.pairingNumber
        ? `🔧 Número de pareamento: ${config.pairingNumber}`
        : '⚠️  LOGIN_METHOD=pairing mas PAIRING_NUMBER está vazio — defina-o no .env/config.json.',
    );
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
