// Estado de "mudo" por usuário/grupo. Sem enforcement próprio — pronto
// para um futuro plugin de moderação consumir.
const db = require('./index');

function key(groupId, userId) {
  return `${groupId}:${userId}`;
}

function isMuted(groupId, userId) {
  return !!db.get('mutes').find({ key: key(groupId, userId) }).value();
}

function mute(groupId, userId) {
  if (isMuted(groupId, userId)) return;
  db.get('mutes').push({ key: key(groupId, userId), groupId, userId, mutedAt: Date.now() }).write();
}

function unmute(groupId, userId) {
  db.get('mutes').remove({ key: key(groupId, userId) }).write();
}

module.exports = { isMuted, mute, unmute };
