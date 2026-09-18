const config = require('../lib/config');
const { downloadMessageMedia, getMediaMessage } = require('../lib/media');
const { createSticker, retagSticker } = require('../lib/stickerMaker');
const renameDb = require('../lib/db/rename');

function isStickerTarget(m) {
  return m.hasMedia() && getMediaMessage(m.mediaTarget)?.type === 'stickerMessage';
}

const circleCmd = {
  name: 'circle',
  aliases: ['circulo'],
  async execute({ sock, m, reply }) {
    if (!m.hasMedia()) return reply.t('cmd_circle_usage');

    await reply.t('cmd_sticker_processing');
    const buffer = await downloadMessageMedia(sock, m.mediaTarget);
    const sticker = buffer && (await createSticker(buffer, { estilo: 'circle' }));

    if (!sticker) return reply.t('cmd_sticker_error');
    return reply.sticker(sticker);
  },
};

const stealCmd = {
  name: 'steal',
  aliases: ['roubar'],
  async execute({ sock, m, reply }) {
    if (!isStickerTarget(m)) return reply.t('cmd_steal_usage');

    const buffer = await downloadMessageMedia(sock, m.mediaTarget);
    const sticker = buffer && (await retagSticker(buffer, {
      packName: config.stickerPackName,
      packAuthor: config.stickerPackAuthor,
    }));

    if (!sticker) return reply.t('cmd_sticker_error');
    return reply.sticker(sticker);
  },
};

const renameCmd = {
  name: 'rename',
  aliases: ['renomear'],
  async execute({
    sock, m, reply, match, prefix,
  }) {
    if (!isStickerTarget(m)) return reply.t('cmd_rename_usage', { prefix });

    let packName;
    let packAuthor;
    let salvouAgora = false;

    if (match.includes('/')) {
      [packName, packAuthor] = match.split('/').map((v) => v.trim());
      renameDb.set(m.sender, { packName, author: packAuthor });
      salvouAgora = true;
    } else {
      const salvo = renameDb.get(m.sender);
      packName = salvo?.packName || config.stickerPackName;
      packAuthor = salvo?.author || config.stickerPackAuthor;
    }

    const buffer = await downloadMessageMedia(sock, m.mediaTarget);
    const sticker = buffer && (await retagSticker(buffer, { packName, packAuthor }));
    if (!sticker) return reply.t('cmd_sticker_error');

    await reply.sticker(sticker);
    if (salvouAgora) await reply.t('cmd_rename_saved', { pack: packName, author: packAuthor });
    return undefined;
  },
};

module.exports = [circleCmd, stealCmd, renameCmd];
