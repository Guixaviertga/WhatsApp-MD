// Sessões em memória de coleta de "pacote de figurinhas", usadas pelo
// comando .pack (plugins/sticker.js) e por lib/handle.js.
const sessions = new Map();

function start(chatId, packName, packAuthor) {
  sessions.set(chatId, { packName, packAuthor, count: 0 });
}

function isActive(chatId) {
  return sessions.has(chatId);
}

function get(chatId) {
  return sessions.get(chatId) || null;
}

function increment(chatId) {
  const session = sessions.get(chatId);
  if (session) session.count += 1;
}

function end(chatId) {
  const session = sessions.get(chatId);
  sessions.delete(chatId);
  return session || null;
}

module.exports = { start, isActive, get, increment, end };
