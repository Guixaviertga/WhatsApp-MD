// Filtros de resposta automática personalizados por chat, cadastrados em
// runtime (ex.: um futuro plugin ".filter add <palavra> | <resposta>").
// Complementa (sem substituir) os presets globais em lib/presets.js.
const db = require('./index');

function list(chatId) {
  return db.get('filters').filter({ chatId }).value();
}

function add(chatId, { keywords, reply }) {
  db.get('filters').push({ chatId, keywords, reply, createdAt: Date.now() }).write();
}

function remove(chatId, index) {
  const entries = list(chatId);
  const target = entries[index];
  if (!target) return false;
  db.get('filters').remove((entry) => entry === target).write();
  return true;
}

function findMatch(chatId, text) {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();
  const entry = list(chatId).find((filter) => (
    filter.keywords.some((kw) => normalized.includes(String(kw).toLowerCase()))
  ));
  return entry ? entry.reply : null;
}

module.exports = { list, add, remove, findMatch };
