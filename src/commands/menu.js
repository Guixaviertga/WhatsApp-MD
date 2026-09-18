const i18n = require('../i18n');
const config = require('../config/env');

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
    const lang = i18n.getChatLanguage(chatId);
    const lines = allCommands.map((cmd) => {
      const desc = cmd.description[lang] || cmd.description.en;
      return `*${config.botPrefix}${cmd.name}* — ${desc}`;
    });

    const text = [
      i18n.t(chatId, 'menu_title'),
      '',
      ...lines,
      '',
      i18n.t(chatId, 'menu_footer', { prefix: config.botPrefix }),
    ].join('\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
  },
};
