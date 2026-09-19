const { criarAttp, LIMITE_CARACTERES } = require('../lib/attp');
const { createSticker } = require('../lib/stickerMaker');

const attpCmd = {
  name: 'attp',
  aliases: ['texto'],
  async execute({ m, reply, match, prefix }) {
    // Sem texto no comando, aceita o texto da mensagem respondida — é o
    // jeito natural de transformar a fala de outra pessoa em figurinha.
    const texto = (match || m.quotedText || '').trim();
    if (!texto) return reply.t('cmd_attp_usage', { prefix });
    if (texto.length > LIMITE_CARACTERES) {
      return reply.t('cmd_attp_muito_longo', { limite: LIMITE_CARACTERES });
    }

    await reply.t('cmd_sticker_processing');

    const gif = await criarAttp(texto);
    // "full" mantém o quadro inteiro: o texto já é desenhado em 512x512
    // centralizado, então cortar as bordas comeria as letras.
    const sticker = await createSticker(gif, { estilo: 'full' });

    if (!sticker) return reply.t('cmd_sticker_error');
    return reply.sticker(sticker);
  },
};

module.exports = [attpCmd];
