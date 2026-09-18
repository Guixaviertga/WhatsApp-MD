const i18n = require('../i18n');
const config = require('../config/env');
const packSession = require('../features/stickerPackSession');

const STOP_WORDS = ['fim', 'end', 'stop', 'done', 'parar'];

module.exports = {
  name: 'pack',
  aliases: ['stickerpack'],
  description: {
    pt: 'Cria um pacote de figurinhas: .pack <nome> para iniciar, .pack fim para encerrar',
    en: 'Creates a sticker pack: .pack <name> to start, .pack fim to finish',
    es: 'Crea un paquete de figuritas: .pack <nombre> para iniciar, .pack fim para terminar',
    hi: 'स्टिकर पैक बनाएं: शुरू करने के लिए .pack <नाम>, समाप्त करने के लिए .pack fim',
    ar: 'ينشئ حزمة ملصقات: .pack <الاسم> للبدء، .pack fim للإنهاء',
  },
  async execute({ sock, chatId, args, prefix, message, senderName }) {
    const sub = (args[0] || '').toLowerCase();

    if (STOP_WORDS.includes(sub)) {
      const session = packSession.end(chatId);
      const text = session
        ? `✅ ${session.packName}: ${session.count} figurinha(s) criada(s).`
        : i18n.t(chatId, 'cmd_stickerpack_usage', { prefix });
      await sock.sendMessage(chatId, { text }, { quoted: message });
      return;
    }

    const packName = args.join(' ').trim();
    if (!packName) {
      await sock.sendMessage(
        chatId,
        { text: i18n.t(chatId, 'cmd_stickerpack_usage', { prefix }) },
        { quoted: message },
      );
      return;
    }

    packSession.start(chatId, packName, senderName || config.stickerPackAuthor);
    await sock.sendMessage(
      chatId,
      {
        text: `📦 Pacote "*${packName}*" iniciado! Envie as imagens/vídeos agora.\n`
          + `Quando terminar, envie "${prefix}pack fim".`,
      },
      { quoted: message },
    );
  },
};
