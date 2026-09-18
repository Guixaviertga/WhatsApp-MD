const lang = require('../lib/lang');

module.exports = {
  name: 'lang',
  aliases: ['idioma', 'language'],
  async execute({ m, reply, args, prefix }) {
    const available = lang.availableLanguages.join(', ');
    const code = (args[0] || '').toLowerCase();

    if (!code) return reply.t('cmd_lang_usage', { prefix, available });
    if (!lang.isSupported(code)) return reply.t('cmd_lang_invalid', { available });

    lang.setChatLanguage(m.chatId, code);
    return reply.t('cmd_lang_set', { language: code });
  },
};
