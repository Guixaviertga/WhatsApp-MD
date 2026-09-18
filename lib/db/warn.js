// Contador de avisos por usuário/grupo. Sem enforcement próprio — pronto
// para um futuro plugin de moderação (ex.: group.js) consumir.
const db = require('./index');

function key(groupId, userId) {
  return `${groupId}:${userId}`;
}

function getWarns(groupId, userId) {
  return db.get('warns').find({ key: key(groupId, userId) }).value()?.count || 0;
}

function addWarn(groupId, userId) {
  const k = key(groupId, userId);
  const existing = db.get('warns').find({ key: k }).value();
  const count = (existing?.count || 0) + 1;
  if (existing) {
    db.get('warns').find({ key: k }).assign({ count }).write();
  } else {
    db.get('warns').push({ key: k, groupId, userId, count }).write();
  }
  return count;
}

function resetWarns(groupId, userId) {
  db.get('warns').remove({ key: key(groupId, userId) }).write();
}

module.exports = { getWarns, addWarn, resetWarns };
