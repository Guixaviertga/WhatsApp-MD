// Classe base compartilhada pelas demais classes de lib/class/. Mantém
// apenas a referência ao socket da sessão que originou o objeto.
class Base {
  constructor(sock) {
    this.sock = sock;
  }
}

module.exports = Base;
