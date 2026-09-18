const lang = require('../lib/lang');
const config = require('../lib/config');
const { extractMediaTarget, downloadMessageMedia } = require('../lib/media');
const { createSticker } = require('../lib/stickerMaker');
const { sendWithRetry } = require('../lib/sendMessage');
const stickerPack = require('../lib/stickerPack');

const STOP_WORDS = ['fim', 'end', 'stop', 'done', 'parar'];

const stickerCmd = {
  name: 'sticker',
  aliases: ['s', 'figurinha'],
  description: {
    pt: 'Cria uma figurinha a partir de uma imagem/vídeo',
    en: 'Creates a sticker from an image/video',
    es: 'Crea una figurita a partir de una imagen/video',
    hi: 'इमेज/वीडियो से स्टिकर बनाता है',
    ar: 'ينشئ ملصقًا من صورة/فيديو',
  },
  async execute({
    sock, chatId, message, prefix,
  }) {
    const target = extractMediaTarget(message);
    if (!target) {
      await sendWithRetry(
        sock,
        chatId,
        { text: lang.t(chatId, 'cmd_sticker_usage', { prefix }) },
        { quoted: message },
      );
      return;
    }

    await sendWithRetry(sock, chatId, { text: lang.t(chatId, 'cmd_sticker_processing') }, { quoted: message });

    const buffer = await downloadMessageMedia(sock, target);
    const stickerBuffer = buffer && (await createSticker(buffer));

    if (!stickerBuffer) {
      await sendWithRetry(sock, chatId, { text: lang.t(chatId, 'cmd_sticker_error') }, { quoted: message });
      return;
    }

    await sendWithRetry(sock, chatId, { sticker: stickerBuffer }, { quoted: message });
  },
};

const packCmd = {
  name: 'pack',
  aliases: ['stickerpack'],
  description: {
    pt: 'Cria um pacote de figurinhas: .pack <nome> para iniciar, .pack fim para encerrar',
    en: 'Creates a sticker pack: .pack <name> to start, .pack fim to finish',
    es: 'Crea un paquete de figuritas: .pack <nombre> para iniciar, .pack fim para terminar',
    hi: 'स्टिकर पैक बनाएं: शुरू करने के लिए .pack <नाम>, समाप्त करने के लिए .pack fim',
    ar: 'ينشئ حزمة ملصقات: .pack <الاسم> للبدء، .pack fim للإنهاء',
  },
  async execute({
    sock, chatId, args, prefix, message, senderName,
  }) {
    const sub = (args[0] || '').toLowerCase();

    if (STOP_WORDS.includes(sub)) {
      const session = stickerPack.end(chatId);
      const text = session
        ? `✅ ${session.packName}: ${session.count} figurinha(s) criada(s).`
        : lang.t(chatId, 'cmd_stickerpack_usage', { prefix });
      await sendWithRetry(sock, chatId, { text }, { quoted: message });
      return;
    }

    const packName = args.join(' ').trim();
    if (!packName) {
      await sendWithRetry(
        sock,
        chatId,
        { text: lang.t(chatId, 'cmd_stickerpack_usage', { prefix }) },
        { quoted: message },
      );
      return;
    }

    stickerPack.start(chatId, packName, senderName || config.stickerPackAuthor);
    await sendWithRetry(
      sock,
      chatId,
      {
        text: `📦 Pacote "*${packName}*" iniciado! Envie as imagens/vídeos agora.\n`
          + `Quando terminar, envie "${prefix}pack fim".`,
      },
      { quoted: message },
    );
  },
};

module.exports = [stickerCmd, packCmd];
