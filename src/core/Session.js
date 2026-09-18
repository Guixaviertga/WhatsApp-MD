const path = require('path');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const config = require('../config/env');
const { createLogger } = require('../utils/logger');
const { handleCommand } = require('../commands');
const { findReply } = require('../features/autoReply');
const { markAsRead } = require('../features/autoRead');
const { handleStatus, isStatusMessage } = require('../features/autoStatusView');
const { registerAutoRejectCall } = require('../features/autoRejectCall');
const packSession = require('../features/stickerPackSession');
const { extractMediaTarget, downloadMessageMedia } = require('../utils/media');
const { createSticker } = require('../features/stickerMaker');

function extractText(message) {
  const m = message.message;
  return (
    m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || ''
  );
}

/**
 * Wraps a single, fully isolated WhatsApp connection: its own auth
 * credentials (sessions/<id>), its own socket instance and its own event
 * handlers, so multiple accounts can run side by side without interfering
 * with one another.
 */
class Session {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logger = createLogger(`session:${sessionId}`);
    this.authDir = path.join(config.sessionsDir, sessionId);
    this.sock = null;
  }

  async start() {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: this.logger.child({ lib: 'baileys' }),
      printQRInTerminal: false,
      browser: [`WhatsApp-MD (${this.sessionId})`, 'Chrome', '1.0.0'],
    });

    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
    sock.ev.on('messages.upsert', (upsert) => this.handleMessagesUpsert(upsert));

    registerAutoRejectCall(sock);

    if (config.loginMethod === 'pairing' && config.pairingNumber && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(config.pairingNumber);
          console.log(`\n📟 [${this.sessionId}] Código de pareamento: ${code}\n`);
        } catch (err) {
          this.logger.error({ err }, 'Failed to request pairing code');
        }
      }, 3000);
    }

    return sock;
  }

  handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr && config.loginMethod === 'qr') {
      console.log(`\n📷 [${this.sessionId}] Escaneie o QR Code abaixo com o WhatsApp:\n`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      this.logger.warn({ statusCode }, 'Connection closed');

      if (shouldReconnect) {
        this.start().catch((err) => this.logger.error({ err }, 'Reconnect failed'));
      } else {
        this.logger.error(
          `Sessão "${this.sessionId}" desconectada (logout). Apague a pasta sessions/${this.sessionId} para logar novamente.`,
        );
      }
    } else if (connection === 'open') {
      this.logger.info(`Sessão "${this.sessionId}" conectada.`);
      console.log(`✅ [${this.sessionId}] Conectado ao WhatsApp!`);
    }
  }

  async handleMessagesUpsert({ messages, type }) {
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        await this.handleSingleMessage(message);
      } catch (err) {
        this.logger.error({ err }, 'Error handling message');
      }
    }
  }

  async handleSingleMessage(message) {
    const { sock } = this;

    if (isStatusMessage(message)) {
      if (config.autoViewStatus) await handleStatus(sock, message);
      return;
    }

    if (message.key.fromMe) return;
    if (!message.message) return;

    const chatId = message.key.remoteJid;

    if (config.autoReadMessages) {
      await markAsRead(sock, message.key);
    }

    if (packSession.isActive(chatId)) {
      const target = extractMediaTarget(message);
      if (target) {
        await this.handlePackMedia(chatId, target);
        return;
      }
    }

    const text = extractText(message);

    const handledAsCommand = await handleCommand({
      sock,
      message,
      chatId,
      text,
      prefix: config.botPrefix,
      senderName: message.pushName,
      sessionId: this.sessionId,
    });
    if (handledAsCommand) return;

    if (config.autoReplyEnabled) {
      const reply = findReply(chatId, text);
      if (reply) {
        await sock.sendMessage(chatId, { text: reply }, { quoted: message });
      }
    }
  }

  async handlePackMedia(chatId, target) {
    const session = packSession.get(chatId);
    if (!session) return;

    const buffer = await downloadMessageMedia(this.sock, target);
    const stickerBuffer = buffer && (await createSticker(buffer, {
      packName: session.packName,
      packAuthor: session.packAuthor,
    }));

    if (stickerBuffer) {
      await this.sock.sendMessage(chatId, { sticker: stickerBuffer });
      packSession.increment(chatId);
    }
  }
}

module.exports = Session;
