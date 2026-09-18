const path = require('path');
const fs = require('fs');

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

// Além do .env, aceita um config.json (útil em painéis que só permitem
// editar variáveis via um arquivo JSON). O .env sempre tem prioridade.
let jsonConfig = {};
const jsonPath = path.join(process.cwd(), 'config.json');
if (fs.existsSync(jsonPath)) {
  try {
    jsonConfig = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    console.error('config.json inválido, ignorando:', err.message);
  }
}

function pick(key, fallback) {
  if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];
  if (jsonConfig[key] !== undefined) return jsonConfig[key];
  return fallback;
}

const config = {
  sessionIds: toList(pick('SESSION_IDS'), ['principal']),
  defaultLanguage: pick('DEFAULT_LANGUAGE', 'pt'),
  botPrefix: pick('BOT_PREFIX', '.'),
  loginMethod: String(pick('LOGIN_METHOD', 'qr')).toLowerCase(),
  pairingNumber: pick('PAIRING_NUMBER', ''),

  autoReadMessages: toBool(pick('AUTO_READ_MESSAGES'), true),
  autoViewStatus: toBool(pick('AUTO_VIEW_STATUS'), true),
  autoReactStatus: toBool(pick('AUTO_REACT_STATUS'), false),
  autoRejectCalls: toBool(pick('AUTO_REJECT_CALLS'), true),
  autoReplyEnabled: toBool(pick('AUTO_REPLY_ENABLED'), true),
  callRejectMessageKey: pick('CALL_REJECT_MESSAGE_KEY', ''),

  stickerPackName: pick('STICKER_PACK_NAME', 'Levanter-MD'),
  stickerPackAuthor: pick('STICKER_PACK_AUTHOR', 'Levanter-MD Bot'),

  apiEnabled: toBool(pick('API_ENABLED'), false),
  apiPort: Number(pick('API_PORT', 3000)),

  logLevel: pick('LOG_LEVEL', 'info'),

  sessionsDir: path.join(process.cwd(), 'sessions'),
  dataDir: path.join(process.cwd(), 'data'),
  databaseDir: path.join(process.cwd(), 'database'),
  mediaDir: path.join(process.cwd(), 'media'),
};

module.exports = config;
