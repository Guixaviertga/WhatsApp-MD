// Apenas a camada de dados (toggle por grupo). A aplicação da regra
// (detectar e agir sobre links) fica para o futuro plugin antiLink.js.
const db = require('./index');

function isEnabled(groupId) {
  return !!db.get('antilink').find({ groupId }).value()?.enabled;
}

function setEnabled(groupId, enabled) {
  const existing = db.get('antilink').find({ groupId }).value();
  if (existing) {
    db.get('antilink').find({ groupId }).assign({ enabled }).write();
  } else {
    db.get('antilink').push({ groupId, enabled }).write();
  }
}

module.exports = { isEnabled, setEnabled };
