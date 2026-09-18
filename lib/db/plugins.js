// Registro dos plugins externos (eplugins) instalados em runtime, por
// exemplo via um Gist. Usado por um futuro plugin ".plugin install <url>".
const db = require('./index');

function list() {
  return db.get('plugins').value();
}

function get(name) {
  return db.get('plugins').find({ name }).value() || null;
}

function add({ name, url, file }) {
  db.get('plugins').remove({ name }).write();
  db.get('plugins').push({ name, url, file, installedAt: Date.now() }).write();
}

function remove(name) {
  db.get('plugins').remove({ name }).write();
}

module.exports = { list, get, add, remove };
