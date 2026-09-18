const fs = require('fs');
const path = require('path');
const config = require('./config');
const lang = require('./lang');
const cmdDb = require('./db/cmd');
const { sendWithRetry } = require('./sendMessage');
const { createLogger } = require('./logger');

const logger = createLogger('cmd');

const PLUGIN_DIRS = [
  path.join(process.cwd(), 'plugins'),
  path.join(process.cwd(), 'eplugins'),
];

const commands = [];
const byName = new Map();

function register(def) {
  if (!def || !def.name) return;
  commands.push(def);
  byName.set(def.name, def);
  for (const alias of def.aliases || []) byName.set(alias, def);
}

function loadDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(dir, file);
    try {
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);
      const defs = Array.isArray(mod) ? mod : [mod];
      defs.forEach(register);
    } catch (err) {
      logger.error({ err, file }, 'Failed to load plugin');
    }
  }
}

/**
 * (Re)carrega todos os comandos de plugins/ (nativos) e eplugins/
 * (instalados em runtime).
 */
function loadAll() {
  commands.length = 0;
  byName.clear();
  loadDir(PLUGIN_DIRS[0]);
  loadDir(PLUGIN_DIRS[1]);
  logger.info({ count: commands.length }, 'Plugins loaded');
}

loadAll();

function parseCommand(text, prefix) {
  if (!text || !text.startsWith(prefix)) return null;
  const withoutPrefix = text.slice(prefix.length).trim();
  if (!withoutPrefix) return null;
  const [commandName, ...args] = withoutPrefix.split(/\s+/);
  return { commandName: commandName.toLowerCase(), args };
}

/**
 * Tenta tratar uma mensagem como comando. Retorna true se um comando foi
 * reconhecido e executado (com sucesso ou não), false se o texto não
 * parece um comando.
 */
async function handleCommand(ctx) {
  const chatConfig = cmdDb.getChatConfig(ctx.chatId);
  const prefix = chatConfig.prefix || ctx.prefix;

  const parsed = parseCommand(ctx.text, prefix);
  if (!parsed) return false;

  if (cmdDb.isDisabled(ctx.chatId, parsed.commandName)) return true;

  const command = byName.get(parsed.commandName);
  if (!command) {
    await sendWithRetry(
      ctx.sock,
      ctx.chatId,
      { text: lang.t(ctx.chatId, 'cmd_unknown', { prefix }) },
      { quoted: ctx.message },
    );
    return true;
  }

  try {
    await command.execute({
      ...ctx, args: parsed.args, prefix, allCommands: commands,
    });
  } catch (err) {
    logger.error({ err, command: parsed.commandName }, 'Command execution failed');
  }
  return true;
}

module.exports = { handleCommand, loadAll, commands };
