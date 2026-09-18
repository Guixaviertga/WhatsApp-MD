const path = require('path');
const fs = require('fs');

const ENV_PATH = path.join(process.cwd(), '.env');
const dotenvResult = require('dotenv').config({ path: ENV_PATH });

// Falha silenciosa aqui é a causa nº 1 de "editei o .env e não mudou nada":
// se o arquivo não existe (ex.: só o config.env.example foi editado, mas
// nunca copiado para .env), o dotenv simplesmente não carrega nada e tudo
// cai nos valores padrão, sem nenhum aviso. Deixamos isso visível.
if (dotenvResult.error && !fs.existsSync(path.join(process.cwd(), 'config.json'))) {
  console.warn(
    `⚠️  Nenhum arquivo .env encontrado em ${ENV_PATH} (nem config.json) — usando apenas valores padrão.\n`
    + '   Crie o .env com: cp config.env.example .env   (e depois edite-o)',
  );
}

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

/**
 * Monta o mapa sessão → número de pareamento.
 *
 * PAIRING_NUMBERS aceita "sessao:numero" separados por vírgula, que é o
 * necessário quando há mais de uma conta. PAIRING_NUMBER continua valendo
 * como forma simples para quem tem só uma sessão.
 */
function parsePairingNumbers(raw, single, sessionIds) {
  const map = {};

  for (const entry of toList(raw)) {
    const separator = entry.lastIndexOf(':');
    if (separator < 1) continue;
    const id = entry.slice(0, separator).trim();
    const number = entry.slice(separator + 1).replace(/\D/g, '');
    if (id && number) map[id] = number;
  }

  // Com uma única sessão, PAIRING_NUMBER não é ambíguo: é dela.
  const onlyNumber = String(single || '').replace(/\D/g, '');
  if (onlyNumber && sessionIds.length === 1 && !map[sessionIds[0]]) {
    map[sessionIds[0]] = onlyNumber;
  }

  return map;
}

const sessionIds = toList(pick('SESSION_IDS'), ['principal']);

const config = {
  sessionIds,

  // Números com permissão de dono (só dígitos, com DDI). Comandos
  // marcados com "owner: true" só respondem a estes números.
  ownerNumbers: toList(pick('OWNER_NUMBERS')).map((n) => n.replace(/\D/g, '')).filter(Boolean),

  defaultLanguage: pick('DEFAULT_LANGUAGE', 'pt'),
  botPrefix: pick('BOT_PREFIX', '.'),
  loginMethod: String(pick('LOGIN_METHOD', 'qr')).toLowerCase(),
  pairingNumbers: parsePairingNumbers(pick('PAIRING_NUMBERS'), pick('PAIRING_NUMBER'), sessionIds),

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

  // ---- Logs ----
  logLevel: pick('LOG_LEVEL', 'info'),
  // Saída colorida e compacta (ideal no Termux). false = JSON cru, para
  // painéis que processam os logs automaticamente.
  logPretty: toBool(pick('LOG_PRETTY'), true),
  // O Baileys loga cada nó do protocolo; no mesmo nível do bot ele afoga
  // as mensagens úteis. Por padrão fica silencioso — suba para "warn" ou
  // "debug" só quando precisar investigar a conexão.
  baileysLogLevel: pick('BAILEYS_LOG_LEVEL', 'silent'),
  logToFile: toBool(pick('LOG_TO_FILE'), false),
  logDir: path.join(process.cwd(), pick('LOG_DIR', 'logs')),
  logRetentionDays: Number(pick('LOG_RETENTION_DAYS', 7)),
  // Conteúdo de mensagem é dado pessoal — só entra no log se você pedir.
  logMessageContent: toBool(pick('LOG_MESSAGE_CONTENT'), false),

  sessionsDir: path.join(process.cwd(), 'sessions'),
  dataDir: path.join(process.cwd(), 'data'),
  databaseDir: path.join(process.cwd(), 'database'),
  mediaDir: path.join(process.cwd(), 'media'),
};

module.exports = config;
