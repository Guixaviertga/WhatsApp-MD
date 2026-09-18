const fs = require('fs');
const path = require('path');
const config = require('./config');
const lang = require('./lang');
const greetingsDb = require('./db/greetings');
const { sendWithRetry } = require('./sendMessage');
const { createLogger } = require('./logger');

const logger = createLogger('participantUpdate');

function randomMedia(folder) {
  const dir = path.join(config.mediaDir, folder);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f));
  if (!files.length) return null;
  return path.join(dir, files[Math.floor(Math.random() * files.length)]);
}

/**
 * Reage a entradas/saídas de participantes em grupos, enviando mensagens
 * de boas-vindas/despedida quando habilitado via lib/db/greetings.js.
 */
async function handleParticipantUpdate(sock, update) {
  const { id: groupId, participants, action } = update;
  if (action !== 'add' && action !== 'remove') return;

  const settings = greetingsDb.get(groupId);
  const enabled = action === 'add' ? settings.welcome : settings.goodbye;
  if (!enabled) return;

  const key = action === 'add' ? 'welcome_message' : 'goodbye_message';
  const customText = action === 'add' ? settings.welcomeText : settings.goodbyeText;
  const mediaPath = randomMedia(action === 'add' ? 'welFolder' : 'goodFolder');

  for (const participant of participants) {
    const user = `@${participant.split('@')[0]}`;
    const text = customText || lang.t(groupId, key, { user, group: groupId });
    const content = mediaPath
      ? { image: { url: mediaPath }, caption: text, mentions: [participant] }
      : { text, mentions: [participant] };

    try {
      await sendWithRetry(sock, groupId, content);
    } catch (err) {
      logger.error({ err, groupId }, 'falha ao enviar mensagem de boas-vindas');
    }
  }
}

module.exports = { handleParticipantUpdate };
