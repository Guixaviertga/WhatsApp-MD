const config = require('./config');
const cmd = require('./cmd');
const filterDb = require('./db/filter');
const presets = require('./presets');
const { sendWithRetry } = require('./sendMessage');
const { extractMediaTarget, downloadMessageMedia } = require('./media');
const { createSticker } = require('./stickerMaker');
const stickerPack = require('./stickerPack');

const STATUS_JID = 'status@broadcast';

function extractText(raw) {
  const m = raw.message;
  if (!m) return '';
  return (
    m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || ''
  );
}

async function handleStatus(sock, message) {
  if (!config.autoViewStatus) return;

  try {
    await sock.readMessages([message.key]);
  } catch {
    return;
  }

  if (config.autoReactStatus) {
    try {
      await sock.sendMessage(
        STATUS_JID,
        { react: { text: '❤️', key: message.key } },
        { statusJidList: [message.key.participant].filter(Boolean) },
      );
    } catch {
      // reação a status é cosmética — ignora falhas silenciosamente
    }
  }
}

async function handlePackMedia(sock, chatId, target) {
  const session = stickerPack.get(chatId);
  if (!session) return;

  const buffer = await downloadMessageMedia(sock, target);
  const stickerBuffer = buffer && (await createSticker(buffer, {
    packName: session.packName,
    packAuthor: session.packAuthor,
  }));

  if (stickerBuffer) {
    await sendWithRetry(sock, chatId, { sticker: stickerBuffer });
    stickerPack.increment(chatId);
  }
}

/**
 * Processa uma única mensagem recebida: visualização de status, confirmação
 * de leitura, coleta de pacote de figurinhas, comandos e respostas
 * automáticas (filtros por chat + presets globais).
 */
async function handleMessage(sock, message, sessionId) {
  if (message.key.remoteJid === STATUS_JID) {
    await handleStatus(sock, message);
    return;
  }

  if (message.key.fromMe) return;
  if (!message.message) return;

  const chatId = message.key.remoteJid;

  if (config.autoReadMessages) {
    try {
      await sock.readMessages([message.key]);
    } catch {
      // rede instável — a mensagem apenas não será marcada como lida
    }
  }

  if (stickerPack.isActive(chatId)) {
    const target = extractMediaTarget(message);
    if (target) {
      await handlePackMedia(sock, chatId, target);
      return;
    }
  }

  const text = extractText(message);

  const handledAsCommand = await cmd.handleCommand({
    sock,
    message,
    chatId,
    text,
    prefix: config.botPrefix,
    senderName: message.pushName,
    sessionId,
  });
  if (handledAsCommand) return;

  if (config.autoReplyEnabled) {
    const reply = filterDb.findMatch(chatId, text) || presets.findReply(chatId, text);
    if (reply) {
      await sendWithRetry(sock, chatId, { text: reply }, { quoted: message });
    }
  }
}

module.exports = { handleMessage, handleStatus };
