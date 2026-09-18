const config = require('../lib/config');
const { downloadMessageMedia } = require('../lib/media');
const { createSticker } = require('../lib/stickerMaker');
const stickerPack = require('../lib/stickerPack');

const STOP_WORDS = ['fim', 'end', 'stop', 'done', 'parar'];

const stickerCmd = {
  name: 'sticker',
  aliases: ['s', 'figurinha'],
  async execute({ sock, m, reply, prefix }) {
    if (!m.hasMedia()) return reply.t('cmd_sticker_usage', { prefix });

    await reply.t('cmd_sticker_processing');

    const buffer = await downloadMessageMedia(sock, m.mediaTarget);
    const sticker = buffer && (await createSticker(buffer));

    if (!sticker) return reply.t('cmd_sticker_error');
    return reply.sticker(sticker);
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
