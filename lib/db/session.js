const db = require('./index');

function list() {
  return db.get('sessions').value();
}

function has(sessionId) {
  return !!db.get('sessions').find({ id: sessionId }).value();
}

function add(sessionId) {
  if (has(sessionId)) return;
  db.get('sessions').push({ id: sessionId, createdAt: Date.now() }).write();
}

function remove(sessionId) {
  db.get('sessions').remove({ id: sessionId }).write();
}

module.exports = { list, has, add, remove };
