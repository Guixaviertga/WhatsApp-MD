const { downloadMediaMessage, extractMessageContent, getContentType } = require('baileys');
const { createLogger } = require('./logger');

const logger = createLogger('media');

const MEDIA_TYPES = new Set([
  'imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage', 'audioMessage',
]);

/**
 * Baixa a mídia (imagem/vídeo/figurinha) de uma mensagem como Buffer.
 * Retorna null se a mensagem não tiver mídia baixável.
 */
async function downloadMessageMedia(sock, message) {
  // Sem esta guarda, o Baileys lê message.message e estoura um
  // "Cannot read properties of null", que não diz nada sobre a causa.
  if (!message?.message) {
    logger.warn('download pedido sem mensagem de mídia');
    return null;
  }

  try {
    return await downloadMediaMessage(
      message,
      'buffer',
      {},
      { logger, reuploadRequest: sock.updateMediaMessage },
    );
  } catch (err) {
    logger.error({ err }, 'falha ao baixar mídia');
    return null;
  }
}

/**
 * Identifica a mídia de uma mensagem. Usa o extractMessageContent do
 * próprio Baileys, que desembrulha mensagens temporárias e de
 * visualização única — o mesmo desempacotamento que o downloader faz
 * internamente, para que detectar e baixar nunca discordem.
 */
function getMediaMessage(message) {
  const content = extractMessageContent(message?.message);
  if (!content) return null;
  const type = getContentType(content);
  return MEDIA_TYPES.has(type) ? { type, node: content[type] } : null;
}

/**
 * Procura mídia na própria mensagem ou na mensagem citada/respondida
 * (padrão comum de ".sticker" respondendo a uma imagem).
 */
function extractMediaTarget(message) {
  if (getMediaMessage(message)) return message;

  const content = extractMessageContent(message?.message) || message?.message;
  const contextInfo = content?.extendedTextMessage?.contextInfo
    || content?.imageMessage?.contextInfo
    || content?.videoMessage?.contextInfo;

  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return null;

  const quotedMessage = {
    key: {
      remoteJid: message.key.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant,
      fromMe: false,
    },
    message: quoted,
  };

  return getMediaMessage(quotedMessage) ? quotedMessage : null;
}

module.exports = { downloadMessageMedia, getMediaMessage, extractMediaTarget };
