// Respostas automáticas globais (predefinidas), carregadas de
// data/replies.json. São o "padrão de fábrica"; filtros específicos por
// chat cadastrados em runtime (lib/db/filter.js) têm prioridade sobre
// estes presets — ver lib/handle.js.
const fs = require('fs');
const path = require('path');
const config = require('./config');
const lang = require('./lang');
const { createLogger } = require('./logger');

const logger = createLogger('presets');
const REPLIES_PATH = path.join(config.dataDir, 'replies.json');

let rules = [];

function load() {
  try {
    const raw = fs.readFileSync(REPLIES_PATH, 'utf8');
    rules = JSON.parse(raw).rules || [];
    logger.info({ count: rules.length }, 'Loaded preset auto-reply rules');
  } catch (err) {
    logger.error({ err }, 'Could not load data/replies.json');
    rules = [];
  }
}

load();

function findReply(chatId, text) {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();
  const chatLang = lang.getChatLanguage(chatId);

  for (const rule of rules) {
    const keywords = rule.keywords || [];
    const matched = keywords.some((kw) => normalized.includes(String(kw).toLowerCase()));
    if (!matched) continue;

    if (rule.replies) {
      return rule.replies[chatLang] || rule.replies[config.defaultLanguage] || rule.replies.en;
    }
    if (rule.key) {
      return lang.t(chatId, rule.key);
    }
  }
  return null;
}

module.exports = { findReply, load };
