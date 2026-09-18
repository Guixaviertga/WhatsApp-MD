// Estado reservado para um futuro plugin de "Word Chain Game" (jogo da
// forca de palavras encadeadas). Ainda não é usado por nenhum plugin —
// existe apenas como infraestrutura pronta na nova estrutura de pastas.
class Wcg {
  constructor(chatId) {
    this.chatId = chatId;
    this.active = false;
    this.players = [];
    this.usedWords = [];
    this.lastWord = null;
  }

  start(players = []) {
    this.active = true;
    this.players = players;
    this.usedWords = [];
    this.lastWord = null;
  }

  play(word) {
    this.usedWords.push(word.toLowerCase());
    this.lastWord = word.toLowerCase();
  }

  wasUsed(word) {
    return this.usedWords.includes(word.toLowerCase());
  }

  stop() {
    this.active = false;
  }
}

module.exports = Wcg;
