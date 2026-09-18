module.exports = {
  name: 'ping',
  async execute({ m, reply }) {
    await reply.t('cmd_ping', { ms: Date.now() - m.timestamp });
  },
};
