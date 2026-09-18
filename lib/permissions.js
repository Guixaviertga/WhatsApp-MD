const { jidDecode, isLidUser } = require('baileys');
const config = require('./config');
const { createLogger } = require('./logger');

const logger = createLogger('permissions');

function numberFromJid(jid) {
  return jidDecode(jid)?.user?.replace(/\D/g, '') || null;
}

/**
 * Resolve o número de telefone de quem enviou a mensagem.
 *
 * O WhatsApp pode identificar um remetente por LID (um id interno) em vez
 * do número — nesse caso o id não tem relação com o telefone e comparar
 * direto daria falso negativo. O Baileys mantém o mapeamento LID↔número,
 * então consultamos por ele antes de desistir.
 */
async function resolveSenderNumber(sock, jid) {
  if (!jid) return null;

  if (isLidUser(jid)) {
    try {
      const pn = await sock.signalRepository?.lidMapping?.getPNForLID(jid);
      if (pn) return numberFromJid(pn);
    } catch (err) {
      logger.warn({ err, jid }, 'não foi possível resolver o LID para um número');
    }
    return null;
  }

  return numberFromJid(jid);
}

/**
 * Indica se o remetente é um dos donos configurados em OWNER_NUMBERS.
 * Sem donos configurados, ninguém é dono — comandos restritos ficam
 * inacessíveis em vez de abertos a todos.
 */
async function isOwner(sock, message) {
  if (config.ownerNumbers.length === 0) return false;
  if (message.fromMe) return true;

  const number = await resolveSenderNumber(sock, message.sender);
  return !!number && config.ownerNumbers.includes(number);
}

module.exports = { isOwner, resolveSenderNumber };
