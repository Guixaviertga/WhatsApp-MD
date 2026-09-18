const lang = require('../lib/lang');
const config = require('../lib/config');

module.exports = {
  name: 'menu',
  aliases: ['help', 'ajuda'],
  async execute({ m, reply, allCommands }) {
    // A descrição de cada comando é a chave cmd_<nome>_desc em lang/.
    const lines = allCommands.map(
      (c) => `*${config.botPrefix}${c.name}* — ${lang.t(m.chatId, `cmd_${c.name}_desc`)}`,
    );

    await reply.text([
      lang.t(m.chatId, 'menu_title'),
      '',
      ...lines,
      '',
      lang.t(m.chatId, 'menu_footer', { prefix: config.botPrefix }),
    ].join('\n'));
  },
};
