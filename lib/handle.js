const config = require('./config');
const cmd = require('./cmd');
const filterDb = require('./db/filter');
const presets = require('./presets');
const { Message, ReplyMessage } = require('./class');
const { downloadMessageMedia } = require('./media');
const { createSticker } = require('./stickerMaker');
const stickerPack = require('./stickerPack');
const { createLogger } = require('./logger');

const logger = createLogger('handle');
const STATUS_JID = 'status@broadcast';

/**
 * Dados da mensagem para o log. O conteúdo é pessoal, então só aparece
 * quando LOG_MESSAGE_CONTENT=true; por padrão fica só o tamanho.
 */
function logFields(m) {
  const fields = {
    de: m.senderNumber,
    chat: m.isGroup ? 'grupo' : 'privado',
    tipo: m.type,
  };
  if (config.logMessageContent) fields.texto = m.text;
  else if (m.text) fields.chars = m.text.length;
  return fields;
}

async function handleStatus(sock, m) {
  if (!config.autoViewStatus) return;

  try {
    await sock.readMessages([m.key]);
  } catch {
    return;
  }

  if (config.autoReactStatus) {
    try {
      await sock.sendMessage(
        STATUS_JID,
        { react: { text: '❤️', key: m.key } },
        { statusJidList: [m.key.participant].filter(Boolean) },
      );
    } catch {
      // reação a status é cosmética — ignora falhas silenciosamente
    }
  }
}

async function handlePackMedia(sock, m, reply) {
  const session = stickerPack.get(m.chatId);
  if (!session) return;

  const buffer = await downloadMessageMedia(sock, m.mediaTarget);
  const stickerBuffer = buffer && (await createSticker(buffer, {
    packName: session.packName,
    packAuthor: session.packAuthor,
  }));

  if (stickerBuffer) {
    await reply.sticker(stickerBuffer);
    stickerPack.increment(m.chatId);
  }
}

/**
 * Processa uma única mensagem recebida: visualização de status, confirmação
 * de leitura, coleta de pacote de figurinhas, comandos e respostas
 * automáticas (filtros por chat + presets globais).
 */
async function handleMessage(sock, raw) {
  const m = new Message(sock, raw);

  if (m.isStatus) {
    await handleStatus(sock, m);
    return;
  }

  if (m.fromMe || !raw.message) return;

  logger.info(logFields(m), 'mensagem recebida');

  if (config.autoReadMessages) {
    // Fora do caminho crítico: a confirmação de leitura não deve atrasar
    // a resposta ao usuário.
    sock.readMessages([m.key]).catch(() => {});
  }

  const reply = new ReplyMessage(sock, m);

  if (stickerPack.isActive(m.chatId) && m.hasMedia()) {
    await handlePackMedia(sock, m, reply);
    return;
  }

  if (await cmd.handleCommand({ sock, m })) return;

  if (config.autoReplyEnabled) {
    const custom = filterDb.findMatch(m.chatId, m.text);
    const text = custom || presets.findReply(m.chatId, m.text);
    if (text) {
      logger.info({ de: m.senderNumber, origem: custom ? 'filtro' : 'preset' }, 'resposta automática');
      await reply.text(text);
    }
  }
}

module.exports = { handleMessage };
