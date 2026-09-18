const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const i18n = require('../i18n');
const { createLogger } = require('../utils/logger');

const logger = createLogger('autoReply');
const REPLIES_PATH = path.join(config.dataDir, 'replies.json');

let rules = [];

function loadReplies() {
  try {
    const raw = fs.readFileSync(REPLIES_PATH, 'utf8');
    rules = JSON.parse(raw).rules || [];
    logger.info({ count: rules.length }, 'Loaded auto-reply rules');
  } catch (err) {
    logger.error({ err }, 'Could not load data/replies.json');
    rules = [];
  }
}

loadReplies();

/**
 * Finds a customizable auto-reply for the given chat/text, respecting the
 * chat's current language. Returns null when no rule matches.
 */
function findReply(chatId, text) {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();
  const lang = i18n.getChatLanguage(chatId);

  for (const rule of rules) {
    const keywords = rule.keywords || [];
    const matched = keywords.some((kw) => normalized.includes(String(kw).toLowerCase()));
    if (!matched) continue;

    if (rule.replies) {
      return rule.replies[lang] || rule.replies[config.defaultLanguage] || rule.replies.en;
    }
    if (rule.key) {
      return i18n.t(chatId, rule.key);
    }
  }
  return null;
}

module.exports = { findReply, loadReplies };
