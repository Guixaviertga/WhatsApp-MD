const fs = require('fs');
const path = require('path');
const config = require('../config/env');

const LOCALES_DIR = path.join(__dirname, 'locales');

const locales = {};
for (const file of fs.readdirSync(LOCALES_DIR)) {
  if (!file.endsWith('.json')) continue;
  const code = path.basename(file, '.json');
  locales[code] = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
}

const availableLanguages = Object.keys(locales);

// language chosen per chat (chatId -> language code), kept in memory.
// Persisted per-session by the caller if desired.
const chatLanguages = new Map();

function isSupported(code) {
  return availableLanguages.includes(code);
}

function getChatLanguage(chatId) {
  return chatLanguages.get(chatId) || config.defaultLanguage;
}

function setChatLanguage(chatId, code) {
  if (!isSupported(code)) return false;
  chatLanguages.set(chatId, code);
  return true;
}

function interpolate(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  ));
}

function t(chatId, key, vars = {}) {
  const lang = getChatLanguage(chatId);
  const dict = locales[lang] || locales[config.defaultLanguage] || locales.en;
  const template = dict[key] ?? locales.en?.[key] ?? key;
  return interpolate(template, vars);
}

function languageList() {
  return availableLanguages
    .map((code) => `${code} - ${locales[code].language_name}`)
    .join('\n');
}

module.exports = {
  t,
  isSupported,
  getChatLanguage,
  setChatLanguage,
  availableLanguages,
  languageList,
};
