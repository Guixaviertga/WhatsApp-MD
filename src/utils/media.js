const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { createLogger } = require('./logger');

const logger = createLogger('media');

/**
 * Downloads the media (image/video/sticker) of a message as a Buffer.
 * Returns null if the message has no downloadable media.
 */
async function downloadMessageMedia(sock, message) {
  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      { logger, reuploadRequest: sock.updateMediaMessage },
    );
    return buffer;
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
 * Looks for media either on the message itself or on the message it is
 * quoting/replying to (common pattern for ".sticker" replying to an image).
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
