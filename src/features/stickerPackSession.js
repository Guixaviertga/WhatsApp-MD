// Keeps track of per-chat "sticker pack" collection sessions, used by the
// ".pack <name>" / ".pack fim" commands to group several images/videos sent
// in sequence into stickers that share the same pack name/author metadata.

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
