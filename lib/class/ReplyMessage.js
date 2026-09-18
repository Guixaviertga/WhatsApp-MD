const Base = require('./Base');
const lang = require('../lang');
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

  get options() {
    return { quoted: this.message.raw };
  }

  async text(content) {
    return sendWithRetry(this.sock, this.message.chatId, { text: content }, this.options);
  }

  /**
   * Responde com um texto traduzido para o idioma do chat. É a forma
   * padrão de responder: mantém todo o texto visível dentro de lang/.
   */
  async t(key, vars = {}) {
    return this.text(lang.t(this.message.chatId, key, vars));
  }

  async sticker(buffer) {
    return sendWithRetry(this.sock, this.message.chatId, { sticker: buffer }, this.options);
  }

  async image(buffer, caption) {
    return sendWithRetry(this.sock, this.message.chatId, { image: buffer, caption }, this.options);
  }
}

module.exports = ReplyMessage;
