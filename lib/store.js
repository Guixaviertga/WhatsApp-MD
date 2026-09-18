// Store leve em memória (o Baileys 6+ não traz mais um store embutido).
// Cada sessão deve instanciar a sua própria Store — os contatos de uma
// conta não devem vazar para outra.
class Store {
  constructor() {
    this.contacts = new Map();
    this.groupMetadataCache = new Map();
  }

  bind(sock) {
    sock.ev.on('contacts.upsert', (contacts) => {
      for (const contact of contacts) this.contacts.set(contact.id, contact);
    });
    sock.ev.on('contacts.update', (updates) => {
      for (const update of updates) {
        const existing = this.contacts.get(update.id) || {};
        this.contacts.set(update.id, { ...existing, ...update });
      }
    });
  }

  getName(jid) {
    const contact = this.contacts.get(jid);
    return contact?.notify || contact?.name || jid?.split('@')[0] || jid;
  }

  async getGroupMetadata(sock, groupId, { maxAgeMs = 5 * 60 * 1000 } = {}) {
    const cached = this.groupMetadataCache.get(groupId);
    if (cached && Date.now() - cached.fetchedAt < maxAgeMs) return cached.metadata;

    const metadata = await sock.groupMetadata(groupId);
    this.groupMetadataCache.set(groupId, { metadata, fetchedAt: Date.now() });
    return metadata;
  }
}

module.exports = Store;
