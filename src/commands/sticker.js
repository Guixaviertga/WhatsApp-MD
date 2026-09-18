const i18n = require('../i18n');
const { extractMediaTarget, downloadMessageMedia } = require('../utils/media');
const { createSticker } = require('../features/stickerMaker');
const { sendWithRetry } = require('../utils/safeSend');

module.exports = {
  name: 'sticker',
  aliases: ['s', 'figurinha'],
  description: {
    pt: 'Cria uma figurinha a partir de uma imagem/vídeo',
    en: 'Creates a sticker from an image/video',
    es: 'Crea una figurita a partir de una imagen/video',
    hi: 'इमेज/वीडियो से स्टिकर बनाता है',
    ar: 'ينشئ ملصقًا من صورة/فيديو',
  },
  async execute({ sock, chatId, message, prefix }) {
    const target = extractMediaTarget(message);
    if (!target) {
      await sendWithRetry(
        sock,
        chatId,
        { text: i18n.t(chatId, 'cmd_sticker_usage', { prefix }) },
        { quoted: message },
      );
      return;
    }

    await sendWithRetry(sock, chatId, { text: i18n.t(chatId, 'cmd_sticker_processing') }, { quoted: message });

    const buffer = await downloadMessageMedia(sock, target);
    const stickerBuffer = buffer && (await createSticker(buffer));

    if (!stickerBuffer) {
      await sendWithRetry(sock, chatId, { text: i18n.t(chatId, 'cmd_sticker_error') }, { quoted: message });
      return;
    }

    await sendWithRetry(sock, chatId, { sticker: stickerBuffer }, { quoted: message });
  },
};
