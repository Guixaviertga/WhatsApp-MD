const Base = require('./Base');
const { extractMediaTarget } = require('../media');

// Chaves que acompanham a mensagem sem descrever o seu conteúdo.
const META_KEYS = new Set(['senderKeyDistributionMessage', 'messageContextInfo']);

const TYPE_NAMES = {
  conversation: 'texto',
  extendedTextMessage: 'texto',
  imageMessage: 'imagem',
  videoMessage: 'vídeo',
  audioMessage: 'áudio',
  stickerMessage: 'figurinha',
  documentMessage: 'documento',
  contactMessage: 'contato',
  locationMessage: 'localização',
  reactionMessage: 'reação',
  pollCreationMessage: 'enquete',
  protocolMessage: 'protocolo',
};

function extractText(raw) {
  const m = raw.message;
  if (!m) return '';
  return (
    m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || ''
  );
}

/**
 * Envolve uma mensagem crua do Baileys com getters convenientes, usados
 * por lib/handle.js, lib/cmd.js e pelos plugins.
 */
class Message extends Base {
  #mediaTarget;

  constructor(sock, raw) {
    super(sock);
    this.raw = raw;
    this.key = raw.key;
    this.chatId = raw.key.remoteJid;
    this.sender = raw.key.participant || raw.key.remoteJid;
    this.fromMe = !!raw.key.fromMe;
    this.isGroup = this.chatId?.endsWith('@g.us') || false;
    this.pushName = raw.pushName || null;
    this.timestamp = Number(raw.messageTimestamp || 0) * 1000;
  }

  get text() {
    return extractText(this.raw);
  }

  get isStatus() {
    return this.chatId === 'status@broadcast';
  }

  /** Tipo da mensagem em nome curto (texto, imagem, figurinha...). */
  get type() {
    const key = Object.keys(this.raw.message || {}).find((k) => !META_KEYS.has(k));
    return TYPE_NAMES[key] || key || 'desconhecido';
  }

  /** Só o número do remetente, para log e identificação. */
  get senderNumber() {
    return this.sender?.split('@')[0] || null;
  }

  /** Identificação curta para log: o nome, ou o número se não houver. */
  get label() {
    return this.pushName || this.senderNumber;
  }

  /**
   * A mídia desta mensagem (ou da que ela responde), resolvida uma única
   * vez. Além de evitar reprocessar a mensagem crua a cada acesso, garante
   * que hasMedia() e mediaTarget nunca discordem: o Baileys pode alterar o
   * objeto cru entre duas leituras, e aí a checagem passava mas o download
   * recebia null.
   */
  get mediaTarget() {
    if (this.#mediaTarget === undefined) {
      this.#mediaTarget = extractMediaTarget(this.raw);
    }
    return this.#mediaTarget;
  }

  hasMedia() {
    return this.mediaTarget !== null;
  }
}

module.exports = Message;
