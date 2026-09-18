// Esqueleto de API HTTP + webhook, desativado por padrão
// (API_ENABLED=false). Ainda sem rotas implementadas — adicione-as aqui
// quando for integrar com um painel externo, dashboard ou webhook de
// terceiros.
const express = require('express');
const config = require('./config');
const { createLogger } = require('./logger');

const logger = createLogger('api');

function createApiServer() {
  const app = express();
  app.use(express.json());

  // TODO: registrar rotas aqui, por exemplo:
  // app.get('/status', (req, res) => res.json({ ok: true }));
  // app.post('/webhook', (req, res) => { ... });

  return app;
}

function startApi() {
  if (!config.apiEnabled) return null;

  const app = createApiServer();
  const server = app.listen(config.apiPort, () => {
    logger.info(`API escutando na porta ${config.apiPort} (esqueleto, sem rotas ainda)`);
  });
  return server;
}

module.exports = { createApiServer, startApi };
