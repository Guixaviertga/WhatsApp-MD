const lang = require('../lib/lang');
const config = require('../lib/config');
const { sendWithRetry } = require('../lib/sendMessage');

module.exports = {
  name: 'menu',
  aliases: ['help', 'ajuda'],
  description: {
    pt: 'Mostra este menu de comandos',
    en: 'Shows this command menu',
    es: 'Muestra este menú de comandos',
    hi: 'यह कमांड मेनू दिखाता है',
    ar: 'يعرض قائمة الأوامر هذه',
  },
  async execute({ sock, chatId, allCommands, message }) {
    const chatLang = lang.getChatLanguage(chatId);
    const lines = allCommands.map((c) => {
      const desc = c.description[chatLang] || c.description.en;
      return `*${config.botPrefix}${c.name}* — ${desc}`;
    });

    const text = [
      lang.t(chatId, 'menu_title'),
      '',
      ...lines,
      '',
      lang.t(chatId, 'menu_footer', { prefix: config.botPrefix }),
    ].join('\n');

    await sendWithRetry(sock, chatId, { text }, { quoted: message });
  },
};
