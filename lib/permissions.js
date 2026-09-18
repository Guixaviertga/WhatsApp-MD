const { jidDecode, isLidUser, areJidsSameUser } = require('baileys');
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

/**
 * Localiza um participante na lista do grupo.
 *
 * Um mesmo usuário pode aparecer como número ou como LID conforme o
 * grupo, então comparamos das três formas: id igual, mesmo usuário
 * segundo o Baileys, e o phoneNumber que a v7 anexa aos participantes LID.
 */
function findParticipant(participants = [], jid) {
  if (!jid) return null;
  return participants.find((p) => (
    p.id === jid
    || areJidsSameUser(p.id, jid)
    || (p.phoneNumber && areJidsSameUser(p.phoneNumber, jid))
  )) || null;
}

function isParticipantAdmin(participants, jid) {
  const participant = findParticipant(participants, jid);
  return !!participant?.admin; // 'admin' | 'superadmin' | null
}

async function groupParticipants(sock, groupId) {
  try {
    const metadata = await sock.store.getGroupMetadata(sock, groupId);
    return metadata?.participants || [];
  } catch (err) {
    logger.warn({ err, groupId }, 'não foi possível ler os participantes do grupo');
    return [];
  }
}

/** O remetente é administrador do grupo? (o dono do bot também conta) */
async function isGroupAdmin(sock, message) {
  if (!message.isGroup) return false;
  if (await isOwner(sock, message)) return true;

  const participants = await groupParticipants(sock, message.chatId);
  return isParticipantAdmin(participants, message.sender);
}

/** O próprio bot é administrador do grupo? */
async function isBotAdmin(sock, message) {
  if (!message.isGroup) return false;

  const participants = await groupParticipants(sock, message.chatId);
  const me = sock.user?.id;
  const lid = sock.user?.lid;

  return isParticipantAdmin(participants, me) || (!!lid && isParticipantAdmin(participants, lid));
}

module.exports = {
  isOwner,
  isGroupAdmin,
  isBotAdmin,
  resolveSenderNumber,
  groupParticipants,
  isParticipantAdmin,
  findParticipant,
};
