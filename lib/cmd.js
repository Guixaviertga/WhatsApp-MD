const fs = require('fs');
const path = require('path');
const config = require('./config');
const lang = require('./lang');
const cmdDb = require('./db/cmd');
const { isOwner, isGroupAdmin, isBotAdmin } = require('./permissions');
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
 *     admin: false,             // opcional: quem envia precisa ser admin do grupo
 *     botAdmin: false,          // opcional: o bot precisa ser admin do grupo
 *     async execute({ m, reply, args, match, prefix, sock, allCommands }) {}
 *   };
 *
 * args  = argumentos já separados por espaço
 * match = tudo que veio depois do comando, em uma string só
 *
 * Não usamos o "pattern" (regex) do Levanter de propósito: lá cada
 * mensagem testa o regex de todos os comandos, enquanto aqui um
 * Map.get(nome) resolve em uma busca só, independente de quantos
 * plugins existam.
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
    logger.info({ tentou: parsed.commandName, de: m.label, num: m.senderNumber }, 'desconhecido');
    await reply.t('cmd_unknown', { prefix });
    return true;
  }

  // "admin" e "botAdmin" só fazem sentido em grupo.
  if ((command.group || command.admin || command.botAdmin) && !m.isGroup) {
    logger.warn({ cmd: command.name, de: m.label, num: m.senderNumber }, 'recusado: só em grupo');
    await reply.t('cmd_group_only');
    return true;
  }

  if (command.owner && !(await isOwner(sock, m))) {
    logger.warn({ cmd: command.name, de: m.label, num: m.senderNumber }, 'recusado: só o dono');
    await reply.t('cmd_owner_only');
    return true;
  }

  if (command.admin && !(await isGroupAdmin(sock, m))) {
    logger.warn({ cmd: command.name, de: m.label, num: m.senderNumber }, 'recusado: só admin do grupo');
    await reply.t('cmd_admin_only');
    return true;
  }

  if (command.botAdmin && !(await isBotAdmin(sock, m))) {
    logger.warn({ cmd: command.name, grupo: m.chatId }, 'recusado: o bot não é admin');
    await reply.t('cmd_bot_not_admin');
    return true;
  }

  const startedAt = Date.now();
  try {
    await command.execute({
      sock,
      m,
      reply,
      args: parsed.args,
      // Texto inteiro depois do comando, equivalente ao "match" do
      // Levanter — facilita portar plugins e serve aos casos em que
      // fatiar por espaço atrapalha (nome de pacote, frase de busca).
      match: parsed.args.join(' '),
      prefix,
      allCommands: commands,
    });
    logger.info({
      cmd: command.name, de: m.label, num: m.senderNumber, ms: Date.now() - startedAt,
    }, 'executado');
  } catch (err) {
    logger.error({ err, cmd: command.name, ms: Date.now() - startedAt }, 'falhou');
  }
  return true;
}

module.exports = { handleCommand, loadAll, commands };
