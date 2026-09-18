const fs = require('fs');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const config = require('../config');

if (!fs.existsSync(config.databaseDir)) {
  fs.mkdirSync(config.databaseDir, { recursive: true });
}

const adapter = new FileSync(path.join(config.databaseDir, 'db.json'));
const db = low(adapter);

// Banco de dados local em JSON (lowdb) — sem depender de nenhum serviço
// externo, ideal para Termux e para painéis sem addons de banco de dados.
// Cada arquivo em lib/db/*.js expõe funções de CRUD sobre uma dessas
// coleções.
db.defaults({
  sessions: [],
  plugins: [],
  cmdSettings: [],
  filters: [],
  greetings: [],
  antilink: [],
  warns: [],
  mutes: [],
  votes: [],
}).write();

module.exports = db;
