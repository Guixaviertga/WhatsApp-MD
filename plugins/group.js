const { jidNormalizedUser } = require('baileys');
const { groupParticipants, isParticipantAdmin } = require('../lib/permissions');

/**
 * Comandos de administração de grupo.
 *
 * Diferença deliberada em relação ao Levanter original: lá estes comandos
 * verificam apenas se o *bot* é admin, e o controle de quem pode usá-los
 * fica num sistema separado de SUDO. Aqui exigimos também que **quem
 * envia** seja admin do grupo (ou dono do bot), via a flag "admin" — sem
 * isso, qualquer membro poderia esvaziar o grupo.
 */

/** Quem é o alvo do comando: menção, resposta ou nada. */
function resolveTargets(m) {
  if (m.mentions.length) return m.mentions;
  if (m.quotedSender) return [m.quotedSender];
  return [];
}

async function collectTargets({ sock, m, reply }) {
  const targets = resolveTargets(m);
  if (!targets.length) {
    await reply.t('cmd_group_no_target');
    return null;
  }
  return { targets, participants: await groupParticipants(sock, m.chatId) };
}

const kick = {
  name: 'kick',
  aliases: ['ban', 'remover'],
  admin: true,
  botAdmin: true,
  async execute({ sock, m, reply }) {
    const collected = await collectTargets({ sock, m, reply });
    if (!collected) return undefined;

    // Nunca remover outros administradores: o WhatsApp recusaria, e é uma
    // proteção contra um admin virar o grupo contra os demais.
    const alvos = collected.targets.filter((jid) => !isParticipantAdmin(collected.participants, jid));
    if (!alvos.length) return reply.t('cmd_group_target_is_admin');

    await sock.groupParticipantsUpdate(m.chatId, alvos, 'remove');
    return reply.t('cmd_group_kicked', { count: alvos.length });
  },
};

const add = {
  name: 'add',
  aliases: ['adicionar'],
  admin: true,
  botAdmin: true,
  async execute({
    sock, m, reply, match,
  }) {
    // Aceita o número colado de qualquer forma: +55 11 99999-9999
    const numero = match.replace(/\D/g, '');
    if (!numero) return reply.t('cmd_group_invalid_number');

    const jid = jidNormalizedUser(`${numero}@s.whatsapp.net`);
    const [resultado] = await sock.groupParticipantsUpdate(m.chatId, [jid], 'add');

    // 403: a pessoa não aceita ser adicionada por desconhecidos; o convite
    // precisa ser enviado no privado dela.
    if (resultado?.status === '403') return reply.t('cmd_group_add_private');
    if (resultado?.status !== '200') return reply.t('cmd_group_add_failed', { erro: resultado?.status || '?' });
    return reply.t('cmd_group_added', { numero });
  },
};

const promote = {
  name: 'promote',
  aliases: ['promover'],
  admin: true,
  botAdmin: true,
  async execute({ sock, m, reply }) {
    const collected = await collectTargets({ sock, m, reply });
    if (!collected) return undefined;

    const alvos = collected.targets.filter((jid) => !isParticipantAdmin(collected.participants, jid));
    if (!alvos.length) return reply.t('cmd_group_already_admin');

    await sock.groupParticipantsUpdate(m.chatId, alvos, 'promote');
    return reply.t('cmd_group_promoted', { count: alvos.length });
  },
};

const demote = {
  name: 'demote',
  aliases: ['rebaixar'],
  admin: true,
  botAdmin: true,
  async execute({ sock, m, reply }) {
    const collected = await collectTargets({ sock, m, reply });
    if (!collected) return undefined;

    const alvos = collected.targets.filter((jid) => isParticipantAdmin(collected.participants, jid));
    if (!alvos.length) return reply.t('cmd_group_not_admin_target');

    await sock.groupParticipantsUpdate(m.chatId, alvos, 'demote');
    return reply.t('cmd_group_demoted', { count: alvos.length });
  },
};

const close = {
  name: 'close',
  aliases: ['fechar'],
  admin: true,
  botAdmin: true,
  async execute({ sock, m, reply }) {
    await sock.groupSettingUpdate(m.chatId, 'announcement');
    return reply.t('cmd_group_closed');
  },
};

const open = {
  name: 'open',
  aliases: ['abrir'],
  admin: true,
  botAdmin: true,
  async execute({ sock, m, reply }) {
    await sock.groupSettingUpdate(m.chatId, 'not_announcement');
    return reply.t('cmd_group_opened');
  },
};

module.exports = [kick, add, promote, demote, close, open];
