const config = require('../lib/config');
const { downloadMessageMedia } = require('../lib/media');
const { createSticker } = require('../lib/stickerMaker');
const stickerPack = require('../lib/stickerPack');
const { createLogger } = require('../lib/logger');

const logger = createLogger('sticker');

const STOP_WORDS = ['fim', 'end', 'stop', 'done', 'parar'];

// Estilos aceitos em ".sticker full", etc. Não são traduzidos: são
// literais, como os próprios nomes de comando. O traço continua sendo
// aceito (".sticker -full") porque quem já usava assim não precisa
// reaprender — ver detectarEstilo.
const FLAGS_ESTILO = {
  crop: 'crop', full: 'full', circle: 'circle', circulo: 'circle', borda: 'rounded', arredondada: 'rounded',
};

function detectarEstilo(texto) {
  for (const token of (texto || '').toLowerCase().split(/\s+/)) {
    const estilo = FLAGS_ESTILO[token.replace(/^-+/, '')];
    if (estilo) return estilo;
  }
  return 'crop';
}

const stickerCmd = {
  name: 'sticker',
  aliases: ['s', 'figurinha'],
  async execute({
    sock, m, reply, match, prefix,
  }) {
    if (!m.hasMedia()) return reply.t('cmd_sticker_usage', { prefix });

    // O aviso de "processando" é cosmético: esperar o WhatsApp confirmar
    // o envio dele antes de começar o download só somava uma ida e volta
    // de rede ao tempo total.
    reply.t('cmd_sticker_processing').catch(() => {});

    const inicioDownload = Date.now();
    const buffer = await downloadMessageMedia(sock, m.mediaTarget);
    logger.info(
      { ms: Date.now() - inicioDownload, kb: buffer ? Math.round(buffer.length / 1024) : 0 },
      'mídia baixada',
    );

    const sticker = buffer && (await createSticker(buffer, { estilo: detectarEstilo(match) }));
    if (!sticker) return reply.t('cmd_sticker_error');

    const inicioEnvio = Date.now();
    const enviada = await reply.sticker(sticker);
    logger.info({ ms: Date.now() - inicioEnvio }, 'figurinha enviada');
    return enviada;
  },
};

const packCmd = {
  name: 'pack',
  aliases: ['stickerpack'],
  async execute({
    m, reply, args, match, prefix,
  }) {
    const sub = (args[0] || '').toLowerCase();

    if (STOP_WORDS.includes(sub)) {
      const session = stickerPack.end(m.chatId);
      if (!session) return reply.t('cmd_stickerpack_usage', { prefix });
      return reply.t('cmd_pack_finished', { pack: session.packName, count: session.count });
    }

    const packName = match.trim();
    if (!packName) return reply.t('cmd_stickerpack_usage', { prefix });

    stickerPack.start(m.chatId, packName, m.pushName || config.stickerPackAuthor);
    return reply.t('cmd_pack_started', { pack: packName, prefix });
  },
};

module.exports = [stickerCmd, packCmd];
