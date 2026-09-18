const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const config = require('../config/env');
const { createLogger } = require('../utils/logger');

const logger = createLogger('stickerMaker');

/**
 * Converts an image/video buffer into a WhatsApp sticker (webp) buffer,
 * tagged with the pack name/author configured in .env.
 */
async function createSticker(buffer, { packName, packAuthor, categories } = {}) {
  try {
    const sticker = new Sticker(buffer, {
      pack: packName || config.stickerPackName,
      author: packAuthor || config.stickerPackAuthor,
      type: StickerTypes.FULL,
      categories: categories || ['🤖'],
      quality: 70,
    });
    return await sticker.toBuffer();
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
