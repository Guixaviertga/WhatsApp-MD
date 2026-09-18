const lang = require('../lib/lang');
const { sendWithRetry } = require('../lib/sendMessage');

module.exports = {
  name: 'lang',
  aliases: ['idioma', 'language'],
  description: {
    pt: 'Troca o idioma deste chat (ex: .lang en)',
    en: 'Switches this chat\'s language (e.g. .lang es)',
    es: 'Cambia el idioma de este chat (ej: .lang en)',
    hi: 'इस चैट की भाषा बदलें (उदा: .lang en)',
    ar: 'يغيّر لغة هذه المحادثة (مثال: .lang en)',
  },
  async execute({
    sock, chatId, args, prefix, message,
  }) {
    const available = lang.availableLanguages.join(', ');

    if (!args[0]) {
      await sendWithRetry(
        sock,
        chatId,
        { text: lang.t(chatId, 'cmd_lang_usage', { prefix, available }) },
        { quoted: message },
      );
      return;
    }

    const code = args[0].toLowerCase();
    if (!lang.isSupported(code)) {
      await sendWithRetry(
        sock,
        chatId,
        { text: lang.t(chatId, 'cmd_lang_invalid', { available }) },
        { quoted: message },
      );
      return;
    }

    lang.setChatLanguage(chatId, code);
    await sendWithRetry(
      sock,
      chatId,
      { text: lang.t(chatId, 'cmd_lang_set', { language: code }) },
      { quoted: message },
    );
  },
};
