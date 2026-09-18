// Pack/autor personalizados que o usuário salvou com ".rename Pack / Autor",
// pra reusar sem precisar digitar de novo nas próximas figurinhas roubadas.
const db = require('./index');

function get(userId) {
  return db.get('renames').find({ userId }).value() || null;
}

function set(userId, { packName, author }) {
  const existing = db.get('renames').find({ userId }).value();
  if (existing) {
    db.get('renames').find({ userId }).assign({ packName, author, updatedAt: Date.now() }).write();
  } else {
    db.get('renames').push({
      userId, packName, author, updatedAt: Date.now(),
    }).write();
  }
}

module.exports = { get, set };
