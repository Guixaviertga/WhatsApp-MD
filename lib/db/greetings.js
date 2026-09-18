// Configuração de boas-vindas/despedida por grupo, usada por
// lib/participantUpdate.js.
const db = require('./index');

const DEFAULTS = { welcome: false, goodbye: false, welcomeText: null, goodbyeText: null };

function get(groupId) {
  const entry = db.get('greetings').find({ groupId }).value();
  return entry ? { ...DEFAULTS, ...entry } : { groupId, ...DEFAULTS };
}

function upsert(groupId, patch) {
  const existing = db.get('greetings').find({ groupId }).value();
  if (existing) {
    db.get('greetings').find({ groupId }).assign(patch).write();
  } else {
    db.get('greetings').push({ groupId, ...DEFAULTS, ...patch }).write();
  }
}

function setWelcome(groupId, enabled) {
  upsert(groupId, { welcome: enabled });
}

function setGoodbye(groupId, enabled) {
  upsert(groupId, { goodbye: enabled });
}

function setWelcomeText(groupId, text) {
  upsert(groupId, { welcomeText: text });
}

function setGoodbyeText(groupId, text) {
  upsert(groupId, { goodbyeText: text });
}

module.exports = { get, setWelcome, setGoodbye, setWelcomeText, setGoodbyeText };
