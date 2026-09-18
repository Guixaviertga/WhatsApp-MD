const { downloadMediaMessage } = require('baileys');
const { createLogger } = require('./logger');

const logger = createLogger('media');

/**
 * Baixa a mídia (imagem/vídeo/figurinha) de uma mensagem como Buffer.
 * Retorna null se a mensagem não tiver mídia baixável.
 */
async function downloadMessageMedia(sock, message) {
  try {
    return await downloadMediaMessage(
      message,
      'buffer',
      {},
      { logger, reuploadRequest: sock.updateMediaMessage },
    );
  } catch (err) {
    logger.error({ err }, 'Failed to download media message');
    return null;
  }
}

function getMediaMessage(message) {
  const content = message?.message;
  if (!content) return null;
  if (content.imageMessage) return { type: 'image', node: content.imageMessage };
  if (content.videoMessage) return { type: 'video', node: content.videoMessage };
  if (content.stickerMessage) return { type: 'sticker', node: content.stickerMessage };
  return null;
}

/**
 * Procura mídia na própria mensagem ou na mensagem citada/respondida
 * (padrão comum de ".sticker" respondendo a uma imagem).
 */
function extractMediaTarget(message) {
  const direct = getMediaMessage(message);
  if (direct) return message;

  const contextInfo = message?.message?.extendedTextMessage?.contextInfo
    || message?.message?.imageMessage?.contextInfo
    || message?.message?.videoMessage?.contextInfo;

  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return null;

  const quotedFakeMessage = {
    key: {
      remoteJid: message.key.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant,
    },
    message: quoted,
  };

  return getMediaMessage(quotedFakeMessage) ? quotedFakeMessage : null;
}

module.exports = { downloadMessageMedia, getMediaMessage, extractMediaTarget };
