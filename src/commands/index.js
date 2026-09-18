const fs = require('fs');
const path = require('path');
const i18n = require('../i18n');
const { createLogger } = require('../utils/logger');

const logger = createLogger('commands');

const commands = [];
const byName = new Map();

for (const file of fs.readdirSync(__dirname)) {
  if (file === 'index.js' || !file.endsWith('.js')) continue;
  const command = require(path.join(__dirname, file));
  commands.push(command);
  byName.set(command.name, command);
  for (const alias of command.aliases || []) {
    byName.set(alias, command);
  }
}

/**
 * Parses a text message into { commandName, args } if it starts with the
 * configured prefix, or returns null otherwise.
 */
function parseCommand(text, prefix) {
  if (!text || !text.startsWith(prefix)) return null;
  const withoutPrefix = text.slice(prefix.length).trim();
  if (!withoutPrefix) return null;
  const [commandName, ...args] = withoutPrefix.split(/\s+/);
  return { commandName: commandName.toLowerCase(), args };
}

/**
 * Attempts to handle a message as a command. Returns true if a command was
 * recognized and executed (successfully or not), false if the text does not
 * look like a command.
 */
async function handleCommand(ctx) {
  const parsed = parseCommand(ctx.text, ctx.prefix);
  if (!parsed) return false;

  const command = byName.get(parsed.commandName);
  if (!command) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: i18n.t(ctx.chatId, 'cmd_unknown', { prefix: ctx.prefix }) },
      { quoted: ctx.message },
    );
    return true;
  }

  try {
    await command.execute({ ...ctx, args: parsed.args, allCommands: commands });
  } catch (err) {
    logger.error({ err, command: parsed.commandName }, 'Command execution failed');
  }
  return true;
}

module.exports = { handleCommand, commands };
