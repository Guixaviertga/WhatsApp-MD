const Base = require('./Base');
const { sendWithRetry } = require('../sendMessage');

/**
 * Helper para responder a uma Message específica, sempre citando-a e
 * com retentativa automática (ver lib/sendMessage.js).
 */
class ReplyMessage extends Base {
  constructor(sock, message) {
    super(sock);
    this.message = message;
  }

  async text(content) {
    return sendWithRetry(this.sock, this.message.chatId, { text: content }, { quoted: this.message.raw });
  }

  async sticker(buffer) {
    return sendWithRetry(this.sock, this.message.chatId, { sticker: buffer }, { quoted: this.message.raw });
  }

  async image(buffer, caption) {
    return sendWithRetry(this.sock, this.message.chatId, { image: buffer, caption }, { quoted: this.message.raw });
  }
}

module.exports = ReplyMessage;
