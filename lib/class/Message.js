const Base = require('./Base');
const { extractMediaTarget } = require('../media');

function extractText(raw) {
  const m = raw.message;
  if (!m) return '';
  return (
    m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || ''
  );
}

/**
 * Envolve uma mensagem crua do Baileys com getters convenientes, usados
 * por lib/handle.js, lib/cmd.js e pelos plugins.
 */
class Message extends Base {
  constructor(sock, raw) {
    super(sock);
    this.raw = raw;
    this.key = raw.key;
    this.chatId = raw.key.remoteJid;
    this.sender = raw.key.participant || raw.key.remoteJid;
    this.fromMe = !!raw.key.fromMe;
    this.isGroup = this.chatId?.endsWith('@g.us') || false;
    this.pushName = raw.pushName || null;
    this.timestamp = Number(raw.messageTimestamp || 0) * 1000;
  }

  get text() {
    return extractText(this.raw);
  }

  get isStatus() {
    return this.chatId === 'status@broadcast';
  }

  get mediaTarget() {
    return extractMediaTarget(this.raw);
  }

  hasMedia() {
    return this.mediaTarget !== null;
  }
}

module.exports = Message;
