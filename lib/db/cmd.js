// Configurações de comando por chat: prefixo customizado e comandos
// desativados. Consumido por lib/cmd.js ao processar cada mensagem.
const db = require('./index');

function getChatConfig(chatId) {
  return db.get('cmdSettings').find({ chatId }).value() || { chatId, prefix: null, disabled: [] };
}

function setPrefix(chatId, prefix) {
  const existing = db.get('cmdSettings').find({ chatId }).value();
  if (existing) {
    db.get('cmdSettings').find({ chatId }).assign({ prefix }).write();
  } else {
    db.get('cmdSettings').push({ chatId, prefix, disabled: [] }).write();
  }
}

function isDisabled(chatId, commandName) {
  return getChatConfig(chatId).disabled.includes(commandName);
}

function disable(chatId, commandName) {
  const existing = db.get('cmdSettings').find({ chatId }).value();
  if (existing) {
    if (!existing.disabled.includes(commandName)) {
      db.get('cmdSettings').find({ chatId }).get('disabled').push(commandName).write();
    }
  } else {
    db.get('cmdSettings').push({ chatId, prefix: null, disabled: [commandName] }).write();
  }
}

function enable(chatId, commandName) {
  const existing = db.get('cmdSettings').find({ chatId }).value();
  if (!existing) return;
  db.get('cmdSettings').find({ chatId }).assign({
    disabled: existing.disabled.filter((name) => name !== commandName),
  }).write();
}

module.exports = { getChatConfig, setPrefix, isDisabled, disable, enable };
