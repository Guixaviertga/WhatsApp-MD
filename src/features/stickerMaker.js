const webpmux = require('node-webpmux');
const config = require('../config/env');
const { createLogger } = require('../utils/logger');
const { convertToWebp } = require('../utils/ffmpeg');

const logger = createLogger('stickerMaker');

// EXIF header required by WhatsApp to read the sticker-pack metadata
// (name/author) from a webp file. See node-webpmux's docs / the common
// "writeExif" recipe used by most WhatsApp bots.
const EXIF_HEADER = Buffer.from([
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
  0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
]);

async function writeExif(webpBuffer, packName, packAuthor) {
  const img = new webpmux.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': `whatsapp-md-${Date.now()}`,
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
 * Converts an image/video buffer into a WhatsApp sticker (webp) buffer,
 * tagged with the pack name/author configured in .env.
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

/**
 * Creates several stickers (a "pack") from a list of media buffers, all
 * sharing the same pack name/author metadata.
 */
async function createStickerPack(buffers, packName, packAuthor) {
  const results = [];
  for (const buffer of buffers) {
    const stickerBuffer = await createSticker(buffer, { packName, packAuthor });
    if (stickerBuffer) results.push(stickerBuffer);
  }
  return results;
}

module.exports = { createSticker, createStickerPack };
