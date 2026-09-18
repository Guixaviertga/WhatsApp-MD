const { createLogger } = require('./logger');

const logger = createLogger('queue');

// Uma corrente de promessas por chave. Tarefas da mesma chave rodam em
// ordem; chaves diferentes rodam em paralelo.
const chains = new Map();

/**
 * Enfileira uma tarefa.
 *
 * Usado para processar mensagens: conversas diferentes avançam ao mesmo
 * tempo, mas dentro de uma conversa a ordem é preservada — o que importa,
 * por exemplo, para a coleta do ".pack", que depende da sequência em que
 * as mídias chegam. Antes tudo era processado em série, e uma figurinha
 * de 3 segundos segurava as mensagens de todos os outros chats.
 */
function enqueue(key, task) {
  const previous = chains.get(key) || Promise.resolve();

  // A corrente nunca rejeita: uma tarefa que falha não pode impedir as
  // seguintes daquela conversa de rodarem.
  const current = previous.then(async () => {
    try {
      await task();
    } catch (err) {
      logger.error({ err, key }, 'tarefa falhou na fila');
    }
  });

  chains.set(key, current);

  current.then(() => {
    // Libera a memória quando esta era a última tarefa da chave; sem isso
    // o Map cresceria para sempre, uma entrada por conversa já vista.
    if (chains.get(key) === current) chains.delete(key);
  });

  return current;
}

/** Quantas conversas têm tarefas em andamento (para diagnóstico). */
function pending() {
  return chains.size;
}

module.exports = { enqueue, pending };
