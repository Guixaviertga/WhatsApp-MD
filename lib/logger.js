const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');
const pino = require('pino');
const config = require('./config');

// Formatador próprio em vez de pino-pretty: são 13 dependências a menos
// e uma linha curta o suficiente para caber num terminal de celular.
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const LEVELS = {
  10: { label: 'TRACE', color: COLORS.dim },
  20: { label: 'DEBUG', color: COLORS.dim },
  30: { label: 'INFO ', color: COLORS.cyan },
  40: { label: 'WARN ', color: COLORS.yellow },
  50: { label: 'ERRO ', color: COLORS.red },
  60: { label: 'FATAL', color: COLORS.magenta },
};

const useColor = process.stdout.isTTY;

function paint(text, color) {
  return useColor ? `${color}${text}${COLORS.reset}` : text;
}

function clock(time) {
  const d = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Campos estruturais do pino não entram na linha: já viram prefixo ou ruído.
const HIDDEN = new Set(['level', 'time', 'msg', 'module', 'name', 'pid', 'hostname']);

function formatExtras(entry) {
  const parts = [];
  for (const [key, value] of Object.entries(entry)) {
    if (HIDDEN.has(key)) continue;
    if (key === 'err') {
      parts.push(`${key}=${value?.message || value}`);
      continue;
    }
    parts.push(`${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`);
  }
  return parts.length ? paint(` ${parts.join(' ')}`, COLORS.dim) : '';
}

function formatLine(entry) {
  const level = LEVELS[entry.level] || LEVELS[30];
  const time = paint(clock(entry.time), COLORS.dim);
  const mod = paint((entry.module || '-').slice(0, 14).padEnd(14), COLORS.blue);
  return `${time} ${paint(level.label, level.color)} ${mod} ${entry.msg || ''}${formatExtras(entry)}\n`;
}

function prettyStream() {
  return new Writable({
    write(chunk, _encoding, callback) {
      try {
        process.stdout.write(formatLine(JSON.parse(chunk.toString())));
      } catch {
        process.stdout.write(chunk); // se não for JSON, repassa cru
      }
      callback();
    },
  });
}

/** Remove arquivos de log mais antigos que LOG_RETENTION_DAYS. */
function pruneOldLogs() {
  const limit = Date.now() - config.logRetentionDays * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(config.logDir)) {
    if (!file.endsWith('.log')) continue;
    const full = path.join(config.logDir, file);
    if (fs.statSync(full).mtimeMs < limit) fs.rmSync(full, { force: true });
  }
}

function fileStream() {
  fs.mkdirSync(config.logDir, { recursive: true });
  try {
    pruneOldLogs();
  } catch {
    // limpeza é oportunista — nunca deve impedir o bot de subir
  }
  const day = new Date().toISOString().slice(0, 10);
  // Arquivo sempre em JSON, mesmo com a tela em modo legível: assim dá
  // para filtrar depois com jq/grep.
  return fs.createWriteStream(path.join(config.logDir, `bot-${day}.log`), { flags: 'a' });
}

function buildDestination() {
  const streams = [{
    level: config.logLevel,
    stream: config.logPretty ? prettyStream() : process.stdout,
  }];

  if (config.logToFile) {
    try {
      streams.push({ level: config.logLevel, stream: fileStream() });
    } catch (err) {
      process.stdout.write(`⚠️  Não foi possível abrir o arquivo de log: ${err.message}\n`);
    }
  }

  return pino.multistream(streams);
}

const root = pino(
  { level: config.logLevel, base: undefined },
  buildDestination(),
);

function createLogger(name) {
  return root.child({ module: name });
}

/**
 * Logger dedicado ao Baileys, com nível próprio. Ele registra cada nó do
 * protocolo; no mesmo nível do bot, afoga as mensagens que interessam.
 */
function createBaileysLogger(sessionId) {
  return pino(
    { level: config.baileysLogLevel, base: undefined },
    buildDestination(),
  ).child({ module: `wa:${sessionId}` });
}

module.exports = { createLogger, createBaileysLogger };
