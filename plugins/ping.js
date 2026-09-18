const lang = require('../lib/lang');
const { sendWithRetry } = require('../lib/sendMessage');

module.exports = {
  name: 'ping',
  aliases: [],
  description: {
    pt: 'Testa se o bot está online',
    en: 'Checks if the bot is online',
    es: 'Comprueba si el bot está en línea',
    hi: 'जाँचता है कि बॉट ऑनलाइन है या नहीं',
    ar: 'يتحقق مما إذا كان البوت متصلاً',
  },
  async execute({ sock, chatId, message }) {
    const sentAt = Number(message.messageTimestamp) * 1000;
    const ms = Date.now() - sentAt;
    await sendWithRetry(sock, chatId, { text: lang.t(chatId, 'cmd_ping', { ms }) }, { quoted: message });
  },
};
