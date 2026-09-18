// Re-exporta o config.js da raiz para que os arquivos dentro de lib/
// possam usar require('./config') em vez de require('../config').
module.exports = require('../config');
