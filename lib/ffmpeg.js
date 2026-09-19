const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { createLogger } = require('./logger');

const logger = createLogger('ffmpeg');

const TAMANHO = 512;

// Fórmulas da máscara: 255 = pixel fica opaco, 0 = fica transparente.
// Recebem o tamanho porque a escada pode cair pra 320x320 (ver ESCADA_VIDEO).
function mascaraCirculo(tamanho) {
  const centro = tamanho / 2;
  const raio = centro - 2;
  return `if(lte(pow(X-${centro},2)+pow(Y-${centro},2),pow(${raio},2)),255,0)`;
}

function mascaraArredondada(tamanho) {
  const raio = Math.round((tamanho * 64) / 512);
  const oposto = tamanho - raio;
  const rq = raio * raio;
  return `if(lte(X,${raio})*lte(Y,${raio})*gt(pow(X-${raio},2)+pow(Y-${raio},2),${rq}),0,`
    + `if(gte(X,${oposto})*lte(Y,${raio})*gt(pow(X-${oposto},2)+pow(Y-${raio},2),${rq}),0,`
    + `if(lte(X,${raio})*gte(Y,${oposto})*gt(pow(X-${raio},2)+pow(Y-${oposto},2),${rq}),0,`
    + `if(gte(X,${oposto})*gte(Y,${oposto})*gt(pow(X-${oposto},2)+pow(Y-${oposto},2),${rq}),0,255))))`;
}

function precisaMascara(estilo) {
  return estilo === 'circle' || estilo === 'rounded';
}

/**
 * Recorta a máscara na própria cadeia do vídeo, com uma entrada só.
 *
 * Já tentei fazer isso melhor, gerando a máscara uma vez como segunda
 * entrada e aplicando com "alphamerge" — em teoria bem mais rápido, porque
 * o "geq" é interpretado (não compilado) e aqui roda em todo pixel de todo
 * frame. Na prática aquilo depende demais da versão do ffmpeg: a máscara
 * vira um stream infinito (loop=-1) e, dependendo de como o alphamerge
 * concilia as taxas, ou o arquivo sai cheio de frames duplicados ou o
 * ffmpeg simplesmente nunca termina. E "alphamerge=shortest=1", que
 * resolveria isso, só existe nas versões novas — nas antigas é erro fatal.
 *
 * Esta versão tem uma entrada só, nenhuma opção que varie entre versões e
 * nenhuma sincronização de streams. Não tem como travar.
 */
function filtroComMascaraInline(estilo, tamanho) {
  const expr = estilo === 'circle' ? mascaraCirculo(tamanho) : mascaraArredondada(tamanho);
  return `scale=${tamanho}:${tamanho}:force_original_aspect_ratio=increase,crop=${tamanho}:${tamanho},format=rgba,`
    + `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${expr}'`;
}

function filtroCor(estilo, tamanho) {
  if (estilo === 'full') {
    return `scale=${tamanho}:${tamanho}:force_original_aspect_ratio=decrease,`
      + `pad=${tamanho}:${tamanho}:(ow-iw)/2:(oh-ih)/2:color=black@0`;
  }
  if (precisaMascara(estilo)) {
    return `scale=${tamanho}:${tamanho}:force_original_aspect_ratio=increase,crop=${tamanho}:${tamanho},format=rgba`;
  }
  // "crop" (padrão): cobre o quadro inteiro, cortando o que sobrar — sem
  // borda, mas também sem mostrar a imagem completa.
  return `scale=${tamanho}:${tamanho}:force_original_aspect_ratio=increase,crop=${tamanho}:${tamanho}`;
}

// Um ffmpeg que nunca termina prenderia a fila daquela conversa pra
// sempre, e o usuário ficaria só olhando o "criando sua figurinha...".
// Nenhuma conversão honesta passa disso nem num celular lento.
const TIMEOUT_MS = 120 * 1000;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';
    let expirou = false;

    const timer = setTimeout(() => {
      expirou = true;
      ffmpeg.kill('SIGKILL');
    }, TIMEOUT_MS);

    ffmpeg.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    ffmpeg.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg não encontrado ou falhou ao iniciar: ${err.message}`));
    });

    ffmpeg.on('close', (code) => {
      clearTimeout(timer);

      if (expirou) {
        logger.error({ stderr: stderr.slice(-2000) }, `ffmpeg travou e foi encerrado após ${TIMEOUT_MS / 1000}s`);
        reject(new Error('a conversão travou e foi cancelada.'));
        return;
      }

      if (code !== 0) {
        logger.error({ code, stderr: stderr.slice(-2000) }, 'ffmpeg terminou com erro');
        reject(new Error(`ffmpeg saiu com código ${code}`));
        return;
      }

      resolve({ stderr });
    });
  });
}

// Pasta de trabalho dentro do próprio projeto, e não os.tmpdir(): no
// Android o os.tmpdir() cai em "/tmp" quando TMPDIR não está no ambiente
// (acontece quando o bot não é iniciado direto pelo shell do Termux), e
// "/tmp" não é gravável lá — o que faria toda conversão falhar. A pasta do
// projeto é, por definição, gravável.
const TMP_DIR = path.join(process.cwd(), 'tmp');
let tmpPronta = false;

async function caminhoTemporario(extensao) {
  if (!tmpPronta) {
    await fs.mkdir(TMP_DIR, { recursive: true });
    tmpPronta = true;
  }
  return path.join(TMP_DIR, `${crypto.randomBytes(8).toString('hex')}.${extensao}`);
}

async function apagar(caminho) {
  await fs.unlink(caminho).catch(() => {});
}

/**
 * Duração do clipe em segundos, ou null se não der pra descobrir — quem
 * chama assume o pior caso nesse caso, então a falha aqui não vira erro.
 */
function probeDuracao(inputPath) {
  return new Promise((resolve) => {
    const probe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      '-i', inputPath,
    ]);

    let saida = '';
    probe.stdout.on('data', (chunk) => { saida += chunk.toString(); });
    probe.stderr.on('data', () => {});
    probe.on('error', () => resolve(null));

    probe.on('close', () => {
      const segundos = Number.parseFloat(saida.trim());
      resolve(Number.isFinite(segundos) && segundos > 0 ? segundos : null);
    });
  });
}

// Imagens estáticas (foto/print) chegam ao ffmpeg sem timestamps/duração
// (o demuxer de imagem reporta "Duration: N/A"), então o filtro
// "fps=N" — pensado pra reamostrar vídeos/gifs — não tem como calcular
// quantos frames gerar e descarta o único frame que existe, produzindo um
// webp vazio ("No filtered frames for output stream"). Pra essas entradas
// não aplicamos fps: é sempre 1 frame de qualquer forma.
function isImagemEstatica(buffer) {
  if (buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
  if (buffer.toString('ascii', 1, 4) === 'PNG') return true; // PNG (0x89 'PNG'...)
  if (buffer.toString('ascii', 0, 2) === 'BM') return true; // BMP
  return false;
}

// Um "RIFF....WEBP" no começo do buffer é o único jeito confiável de saber
// se o ffmpeg realmente gerou um webp válido: ele pode sair com código 0
// mesmo sem produzir nada útil (ex.: falha silenciosa do encoder libwebp),
// e nesse caso o buffer vem vazio ou truncado — só isso já quebraria o
// node-webpmux mais adiante com um erro confuso ("Bad header").
function isValidWebp(buffer) {
  return buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP';
}

// O WhatsApp aceita figurinhas maiores, mas fica visivelmente mais lento
// pra enviar/exibir acima disso.
const LIMITE_BYTES = 480 * 1024;

// Imagem estática é 1 frame só: cabe folgado no limite mesmo na melhor
// qualidade, e a compressão máxima (6) custa poucos milissegundos.
const RUNG_ESTATICA = {
  qualidade: 50, fps: 10, compressao: 6, tamanho: TAMANHO,
};

// Vídeo/gif é outra história: o webp animado do ffmpeg codifica cada frame
// inteiro (não faz predição entre frames), então tanto o tempo de conversão
// quanto o tamanho final crescem direto com a QUANTIDADE DE FRAMES — não
// com a duração em si. Por isso o fps não é fixo: ele sai de um orçamento
// de frames (ver fpsPara), pra um clipe de 15s não custar o dobro de um de
// 7s. Um fps fixo obrigaria a escolher entre clipe curto tremido ou clipe
// longo lentíssimo.
// 75 frames, medido: no pior caso (vídeo cheio de ruído, que é o que menos
// comprime) um clipe de 15s fica em ~370KB, com folga confortável até os
// 480KB. Com 90 frames o mesmo clipe batia em 481KB — ou seja, estourava.
const ORCAMENTO_FRAMES = 75;
const FPS_MAX = 10;
const FPS_MIN = 5;

function fpsPara(duracaoSegundos) {
  const alvo = Math.floor(ORCAMENTO_FRAMES / Math.max(1, duracaoSegundos));
  return Math.max(FPS_MIN, Math.min(FPS_MAX, alvo));
}

// Só dois degraus, já começando numa qualidade que costuma caber no limite:
// o caso comum resolve numa conversão só. "cortaFps" é quanto o segundo
// degrau baixa o fps, já que reduzir frames encolhe mais que reduzir
// qualidade. compressao=4 em vez de 6 troca alguns KB por uma codificação
// bem mais rápida, que é o gargalo aqui.
// O último degrau derruba a RESOLUÇÃO, e não só a qualidade, de propósito:
// é a única alavanca que nenhuma diferença de versão/encoder consegue
// ignorar — 320x320 tem 39% dos pixels de 512x512. Serve de rede de
// segurança pra nunca mandar uma figurinha gigante, que o WhatsApp mostra
// como arquivo pra baixar em vez de renderizar.
const ESCADA_VIDEO = [
  {
    qualidade: 20, compressao: 4, cortaFps: 0, tamanho: 512,
  },
  {
    qualidade: 10, compressao: 4, cortaFps: 2, tamanho: 512,
  },
  {
    qualidade: 10, compressao: 4, cortaFps: 2, tamanho: 320,
  },
];

function buildArgs({
  estilo, estatica, duracaoMax, qualidade, fps, compressao, tamanho, inputPath, outPath,
}) {
  const filtro = precisaMascara(estilo)
    ? filtroComMascaraInline(estilo, tamanho)
    : filtroCor(estilo, tamanho);

  const args = [
    '-y',
    '-i', inputPath,
    '-t', String(duracaoMax),
    '-vf', estatica ? filtro : `${filtro},fps=${fps}`,
  ];

  args.push(
    '-vcodec', 'libwebp',
    '-pix_fmt', 'yuva420p',
    '-loop', '0',
    '-an',
    '-vsync', '0',
    // A qualidade vai nas duas formas de propósito. Dependendo da versão
    // do ffmpeg o encoder libwebp lê de "-q:v" (global_quality) ou da
    // opção privada "-quality"; a que não for usada só vira um aviso. Com
    // o mesmo valor nas duas não há conflito, e sem a qualidade aplicada o
    // arquivo sai 2-4x maior (o padrão é 75).
    '-q:v', String(qualidade),
    '-quality', String(qualidade),
    // Explícito porque em modo lossless o parâmetro de qualidade é ignorado
    // por definição — e aí o arquivo fica ~10x maior (medido: 46KB/frame
    // contra 4KB/frame). Não custa nada quando já está em lossy.
    '-lossless', '0',
    '-compression_level', String(compressao),
    ...(estatica ? ['-frames:v', '1'] : []),
    '-f', 'webp',
    outPath,
  );

  return args;
}

async function tentarConversao(opts) {
  const inicio = Date.now();
  const outPath = await caminhoTemporario('webp');
  try {
    const { stderr } = await runFfmpeg(buildArgs({ ...opts, outPath }));
    const buffer = await fs.readFile(outPath);

    if (!isValidWebp(buffer)) {
      logger.error(
        { qualidade: opts.qualidade, bytes: buffer.length, stderr: stderr.slice(-2000) },
        'ffmpeg saiu com código 0 mas não produziu um webp válido',
      );
      return { ok: false, err: new Error('ffmpeg não gerou um webp válido (veja o log "ffmpeg" para detalhes).') };
    }

    const kb = Math.round(buffer.length / 1024);
    logger.info(
      {
        ms: Date.now() - inicio, q: opts.qualidade, fps: opts.fps, px: opts.tamanho, kb,
      },
      'conversão ffmpeg',
    );

    // Passar do limite com a qualidade já baixa quase sempre significa que
    // o ffmpeg ignorou algum parâmetro. O stderr dele diz qual (ex.: um
    // aviso de opção não usada por nenhum stream), então vale registrar —
    // sem isso, só dá pra adivinhar.
    if (buffer.length > LIMITE_BYTES) {
      logger.warn(
        { q: opts.qualidade, kb, stderr: stderr.slice(-1500) },
        'conversão acima do limite — stderr do ffmpeg abaixo',
      );
    }

    return { ok: true, buffer };
  } catch (err) {
    return { ok: false, err };
  } finally {
    await apagar(outPath);
  }
}

/**
 * Converte um buffer de imagem/vídeo/gif em um buffer webp compatível com
 * o WhatsApp usando o binário ffmpeg do sistema. Depende só do ffmpeg, leve
 * de instalar até no Termux (`pkg install ffmpeg`), evitando módulos nativos
 * como o sharp que não têm binários pré-compilados para Android/ARM.
 *
 * Entrada e saída passam por arquivo temporário em vez de pipe, e isso não é
 * negociável: o container webp guarda o tamanho total logo no começo, num
 * campo que o muxer só consegue preencher voltando ao início no fim da
 * escrita. Em pipe não dá pra voltar, então o campo fica zerado e o arquivo
 * sai corrompido — válido o bastante pra passar por uma checagem de
 * cabeçalho, mas o node-webpmux e o próprio WhatsApp o rejeitam. Ler a
 * entrada de arquivo também resolve um .mp4 cujo índice fica no fim.
 *
 * estilo: "crop" (padrão, cobre sem borda) | "full" (mostra tudo, com
 * borda transparente) | "circle" (círculo) | "rounded" (cantos
 * arredondados).
 */
async function convertToWebp(inputBuffer, { estilo = 'crop', duracaoMax = config.stickerMaxDuration } = {}) {
  const estatica = isImagemEstatica(inputBuffer);
  const inputPath = await caminhoTemporario('tmp');

  try {
    await fs.writeFile(inputPath, inputBuffer);

    if (estatica) {
      const resultado = await tentarConversao({
        estilo, estatica, duracaoMax, inputPath, ...RUNG_ESTATICA,
      });
      if (resultado.ok) return resultado.buffer;
      throw resultado.err;
    }

    // Um clipe de 3s não precisa pagar o fps baixo que um de 15s exige,
    // então o fps sai da duração que vai ser realmente usada. Se o ffprobe
    // não conseguir ler a duração, assume o corte máximo (o pior caso).
    const duracaoReal = await probeDuracao(inputPath);
    const duracaoUsada = Math.min(duracaoReal || duracaoMax, duracaoMax);
    const fpsBase = fpsPara(duracaoUsada);

    let ultimoErro;
    let ultimoBuffer;
    for (const rung of ESCADA_VIDEO) {
      // eslint-disable-next-line no-await-in-loop -- de propósito: só cai
      // pra próxima qualidade se a anterior não couber. Rodar as duas
      // sempre (em série ou em paralelo) seria gastar CPU à toa, e num
      // celular paralelizar trabalho preso em CPU não ganha tempo nenhum:
      // os processos só disputam os mesmos núcleos.
      const resultado = await tentarConversao({
        estilo,
        estatica,
        duracaoMax,
        inputPath,
        qualidade: rung.qualidade,
        compressao: rung.compressao,
        tamanho: rung.tamanho,
        fps: Math.max(FPS_MIN, fpsBase - rung.cortaFps),
      });

      if (!resultado.ok) {
        ultimoErro = resultado.err;
        continue;
      }

      if (resultado.buffer.length <= LIMITE_BYTES) return resultado.buffer;
      ultimoBuffer = resultado.buffer;
    }

    // Nenhuma coube no limite: manda a menor mesmo assim, em vez de falhar.
    if (ultimoBuffer) return ultimoBuffer;
    throw ultimoErro || new Error('não foi possível gerar a figurinha.');
  } finally {
    await apagar(inputPath);
  }
}

module.exports = { convertToWebp };
