const webpmux = require('node-webpmux');
const config = require('./config');
const { createLogger } = require('./logger');
const { convertToWebp } = require('./ffmpeg');

const logger = createLogger('stickerMaker');

const EXIF_HEADER = Buffer.from([
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
  0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
]);

async function writeExif(webpBuffer, packName, packAuthor) {
  const img = new webpmux.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': `levanter-md-${Date.now()}`,
    'sticker-pack-name': packName,
    'sticker-pack-publisher': packAuthor,
    emojis: ['🤖'],
  };

  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exifHeader = Buffer.from(EXIF_HEADER);
  exifHeader.writeUIntLE(jsonBuffer.length, 14, 4);

  img.exif = Buffer.concat([exifHeader, jsonBuffer]);
  return img.save(null);
}

/**
 * Converte um buffer de imagem/vídeo em uma figurinha (webp) marcada com
 * o nome/autor do pacote configurados no .env.
 */
async function createSticker(buffer, { packName, packAuthor } = {}) {
  try {
    const webpBuffer = await convertToWebp(buffer);
    return await writeExif(
      webpBuffer,
      packName || config.stickerPackName,
      packAuthor || config.stickerPackAuthor,
    );
  } catch (err) {
    logger.error({ err }, 'Failed to create sticker');
    return null;
  }
}

module.exports = { createSticker };
