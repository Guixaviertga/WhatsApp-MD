const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function toList(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const config = {
  sessionIds: toList(process.env.SESSION_IDS, ['principal']),
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'pt',
  botPrefix: process.env.BOT_PREFIX || '.',
  loginMethod: (process.env.LOGIN_METHOD || 'qr').toLowerCase(),
  pairingNumber: process.env.PAIRING_NUMBER || '',

  autoReadMessages: toBool(process.env.AUTO_READ_MESSAGES, true),
  autoViewStatus: toBool(process.env.AUTO_VIEW_STATUS, true),
  autoReactStatus: toBool(process.env.AUTO_REACT_STATUS, false),
  autoRejectCalls: toBool(process.env.AUTO_REJECT_CALLS, true),
  autoReplyEnabled: toBool(process.env.AUTO_REPLY_ENABLED, true),
  callRejectMessageKey: process.env.CALL_REJECT_MESSAGE_KEY || '',

  stickerPackName: process.env.STICKER_PACK_NAME || 'WhatsApp-MD',
  stickerPackAuthor: process.env.STICKER_PACK_AUTHOR || 'WhatsApp-MD Bot',

  logLevel: process.env.LOG_LEVEL || 'info',

  sessionsDir: path.join(process.cwd(), 'sessions'),
  dataDir: path.join(process.cwd(), 'data'),
};

module.exports = config;
