const qrcode = require('qrcode-terminal');
const { DisconnectReason } = require('baileys');
const config = require('./config');
const lang = require('./lang');
const { handleMessage } = require('./handle');
const { handleParticipantUpdate } = require('./participantUpdate');
const { sendWithRetry } = require('./sendMessage');

/**
 * Registra todos os listeners de eventos de uma sessão: conexão/QR/
 * reconexão, mensagens recebidas, chamadas (rejeição automática) e
 * entradas/saídas de participantes em grupos.
 */
function bindEvents(sock, {
  sessionId, logger, onReconnect, onPairingReady,
}) {
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (config.loginMethod === 'pairing') {
        // O evento "qr" só é emitido depois que o servidor responde ao nó
        // de registro — é o momento seguro para pedir o código de
        // pareamento. Pedir antes disso faz o Baileys gravar creds.me e,
        // em seguida, enviar um nó de login (em vez de registro) para um
        // aparelho que ainda não existe, o que o servidor rejeita.
        onPairingReady?.();
      } else {
        console.log(`\n📷 [${sessionId}] Escaneie o QR Code abaixo com o WhatsApp:\n`);
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode }, 'Connection closed');

      if (shouldReconnect) {
        onReconnect?.();
      } else {
        logger.error(
          `Sessão "${sessionId}" desconectada (logout). Apague a pasta sessions/${sessionId} para logar novamente.`,
        );
      }
    } else if (connection === 'open') {
      logger.info(`Sessão "${sessionId}" conectada.`);
      console.log(`✅ [${sessionId}] Conectado ao WhatsApp!`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      try {
        await handleMessage(sock, message, sessionId);
      } catch (err) {
        logger.error({ err }, 'Error handling message');
      }
    }
  });

  if (config.autoRejectCalls) {
    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        if (call.status !== 'offer') continue;
        try {
          await sock.rejectCall(call.id, call.from);
          logger.info({ from: call.from }, 'Rejected incoming call');

          if (config.callRejectMessageKey) {
            const text = lang.t(call.from, config.callRejectMessageKey);
            await sendWithRetry(sock, call.from, { text });
          }
        } catch (err) {
          logger.error({ err }, 'Failed to reject call');
        }
      }
    });
  }

  sock.ev.on('group-participants.update', (update) => {
    handleParticipantUpdate(sock, update).catch((err) => {
      logger.error({ err }, 'Failed to handle participant update');
    });
  });
}

module.exports = { bindEvents };
