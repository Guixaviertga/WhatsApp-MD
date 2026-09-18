const fs = require('fs');
const path = require('path');
const config = require('./config');
const lang = require('./lang');
const cmdDb = require('./db/cmd');
const { isOwner } = require('./permissions');
const { ReplyMessage } = require('./class');
const { createLogger } = require('./logger');

const logger = createLogger('cmd');

const PLUGIN_DIRS = [
  path.join(process.cwd(), 'plugins'),
  path.join(process.cwd(), 'eplugins'),
];

const commands = [];
const byName = new Map();

/**
 * Contrato de plugin:
 *
 *   module.exports = {
 *     name: 'exemplo',
 *     aliases: ['ex'],          // opcional
 *     owner: false,             // opcional: só os donos podem usar
 *     group: false,             // opcional: só funciona em grupos
 *     async execute({ m, reply, args, prefix, sock, allCommands }) {}
 *   };
 *
 * A descrição não fica aqui: é a chave `cmd_<name>_desc` em lang/*.json,
 * para que todo texto visível ao usuário exista nos 13 idiomas.
 * Um arquivo pode exportar um array de comandos.
 */
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
      logger.error({ err, file }, 'falha ao carregar plugin');
    }
  }
}

function loadAll() {
  commands.length = 0;
  byName.clear();
  loadDir(PLUGIN_DIRS[0]);
  loadDir(PLUGIN_DIRS[1]);
  logger.info({ count: commands.length }, 'plugins carregados');
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
 * Tenta tratar uma mensagem como comando. Retorna true se o texto era um
 * comando (executado ou recusado), false se não parecia um comando.
 */
async function handleCommand({ sock, m }) {
  const chatConfig = cmdDb.getChatConfig(m.chatId);
  const prefix = chatConfig.prefix || config.botPrefix;

  const parsed = parseCommand(m.text, prefix);
  if (!parsed) return false;

  if (cmdDb.isDisabled(m.chatId, parsed.commandName)) return true;

  const reply = new ReplyMessage(sock, m);
  const command = byName.get(parsed.commandName);

  if (!command) {
    logger.info({ tentou: parsed.commandName, de: m.senderNumber }, 'comando desconhecido');
    await reply.t('cmd_unknown', { prefix });
    return true;
  }

  if (command.group && !m.isGroup) {
    logger.warn({ cmd: command.name, de: m.senderNumber }, 'recusado: só em grupo');
    await reply.t('cmd_group_only');
    return true;
  }

  if (command.owner && !(await isOwner(sock, m))) {
    logger.warn({ cmd: command.name, de: m.senderNumber }, 'recusado: só o dono');
    await reply.t('cmd_owner_only');
    return true;
  }

  const startedAt = Date.now();
  try {
    await command.execute({
      sock, m, reply, args: parsed.args, prefix, allCommands: commands,
    });
    logger.info({ cmd: command.name, de: m.senderNumber, ms: Date.now() - startedAt }, 'comando executado');
  } catch (err) {
    logger.error({ err, cmd: command.name, ms: Date.now() - startedAt }, 'comando falhou');
  }
  return true;
}

module.exports = { handleCommand, loadAll, commands };
