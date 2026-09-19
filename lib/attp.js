const path = require('path');
const PImage = require('pureimage');
const GIFEncoder = require('gif-encoder');
const { createLogger } = require('./logger');

const logger = createLogger('attp');

const TAMANHO = 512;
const MARGEM = 40;
const MAX_LINHAS = 4;
const FONTE_MAX = 120;
const FONTE_MIN = 24;
const DELAY_MS = 120;

// Uma cor por frame: a animação do ATTP é o texto trocando de cor em
// sequência, então a quantidade de frames é a quantidade de cores.
const CORES = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de'];

// A fonte vem junto no repositório de propósito: nem o Termux nem um
// container mínimo têm fontes instaladas, e sem arquivo de fonte o
// pureimage não desenha nada.
const FONTE_ARQUIVO = path.join(__dirname, '..', 'media', 'fonts', 'WorkSans-Bold.ttf');
const FONTE_NOME = 'AttpBold';

let fontePronta = false;

function carregarFonte() {
  if (fontePronta) return;
  PImage.registerFont(FONTE_ARQUIVO, FONTE_NOME).loadSync();
  fontePronta = true;
}

/**
 * Quebra o texto em linhas que caibam na largura disponível, respeitando
 * as quebras que o usuário digitou. Uma palavra sozinha maior que a linha
 * fica como está — quem resolve esse caso é a redução do tamanho da fonte.
 */
function quebrarLinhas(ctx, texto, larguraMax) {
  const linhas = [];

  for (const paragrafo of texto.split('\n')) {
    let atual = '';

    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && ctx.measureText(tentativa).width > larguraMax) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }

    linhas.push(atual);
  }

  return linhas.filter((linha) => linha !== '');
}

/**
 * Maior tamanho de fonte em que o texto ainda cabe no quadro, junto com as
 * linhas já quebradas nesse tamanho. Vai diminuindo até caber na largura e
 * na altura, ou até chegar no mínimo legível.
 */
function ajustarTexto(ctx, texto) {
  const largura = TAMANHO - MARGEM * 2;
  const altura = TAMANHO - MARGEM * 2;

  for (let tamanho = FONTE_MAX; tamanho >= FONTE_MIN; tamanho -= 4) {
    ctx.font = `${tamanho}pt ${FONTE_NOME}`;
    const linhas = quebrarLinhas(ctx, texto, largura);
    const alturaLinha = tamanho * 1.25;

    const cabe = linhas.length <= MAX_LINHAS
      && linhas.length * alturaLinha <= altura
      && linhas.every((linha) => ctx.measureText(linha).width <= largura);

    if (cabe) return { tamanho, linhas, alturaLinha };
  }

  ctx.font = `${FONTE_MIN}pt ${FONTE_NOME}`;
  return {
    tamanho: FONTE_MIN,
    linhas: quebrarLinhas(ctx, texto, largura).slice(0, MAX_LINHAS),
    alturaLinha: FONTE_MIN * 1.25,
  };
}

function desenharFrame(texto, cor, medidas) {
  const img = PImage.make(TAMANHO, TAMANHO);
  const ctx = img.getContext('2d');
  ctx.clearRect(0, 0, TAMANHO, TAMANHO);
  ctx.font = `${medidas.tamanho}pt ${FONTE_NOME}`;
  ctx.fillStyle = cor;

  const alturaBloco = medidas.linhas.length * medidas.alturaLinha;
  const topo = (TAMANHO - alturaBloco) / 2 + medidas.tamanho;

  medidas.linhas.forEach((linha, i) => {
    const largura = ctx.measureText(linha).width;
    ctx.fillText(linha, (TAMANHO - largura) / 2, topo + i * medidas.alturaLinha);
  });

  return img;
}

/**
 * Gera um GIF animado com o texto trocando de cor — o "ATTP" clássico.
 *
 * Sai GIF, e não webp direto, porque quem transforma em figurinha é o
 * mesmo caminho já usado por foto e vídeo (ver lib/stickerMaker.js): o GIF
 * é só o formato intermediário. Para texto colorido sobre fundo
 * transparente o GIF dá conta — são poucas cores e bordas bem definidas,
 * exatamente o que ele comprime bem.
 */
async function criarAttp(texto) {
  const inicio = Date.now();
  carregarFonte();

  const medidas = ajustarTexto(PImage.make(TAMANHO, TAMANHO).getContext('2d'), texto);

  const gif = new GIFEncoder(TAMANHO, TAMANHO);
  const partes = [];
  gif.on('data', (parte) => partes.push(parte));

  gif.setRepeat(0);
  gif.setDelay(DELAY_MS);
  // O fundo fica transparente: os pixels que o texto não cobre têm
  // alpha 0, que o GIF guarda como a cor 0x000000 marcada transparente.
  gif.setTransparent(0x000000);
  gif.writeHeader();

  for (const cor of CORES) {
    gif.addFrame(desenharFrame(texto, cor, medidas).data);
  }
  gif.finish();

  const buffer = Buffer.concat(partes);
  logger.info(
    {
      ms: Date.now() - inicio, kb: Math.round(buffer.length / 1024), linhas: medidas.linhas.length, pt: medidas.tamanho,
    },
    'attp gerado',
  );
  return buffer;
}

module.exports = { criarAttp, LIMITE_CARACTERES: 100 };
