// Armazenamento simples de enquetes/votações por chat. Sem plugin próprio
// ainda — pronto para uma futura implementação de ".vote".
const db = require('./index');

function create(chatId, { question, options }) {
  db.get('votes').remove({ chatId }).write();
  db.get('votes').push({
    chatId,
    question,
    options: options.map((label) => ({ label, votes: [] })),
    createdAt: Date.now(),
    open: true,
  }).write();
}

function get(chatId) {
  return db.get('votes').find({ chatId }).value() || null;
}

function cast(chatId, userId, optionIndex) {
  const vote = get(chatId);
  if (!vote || !vote.open) return false;
  for (const option of vote.options) {
    option.votes = option.votes.filter((id) => id !== userId);
  }
  const target = vote.options[optionIndex];
  if (!target) return false;
  target.votes.push(userId);
  db.get('votes').find({ chatId }).assign(vote).write();
  return true;
}

function end(chatId) {
  const vote = get(chatId);
  if (!vote) return null;
  db.get('votes').find({ chatId }).assign({ open: false }).write();
  return vote;
}

module.exports = { create, get, cast, end };
