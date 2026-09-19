const { spawn } = require('child_process');
const { createLogger } = require('./logger');

const logger = createLogger('ffmpeg');

const TAMANHO = 512;
const RAIO = 64;
const OPOSTO = TAMANHO - RAIO;
const RAIO_QUAD = RAIO * RAIO;

// Fórmulas da máscara (255 = mantém opaco, 0 = fica transparente), como
// luminância pura — usadas só pra gerar a imagem estática da máscara (ver
// mascaraLavfi), nunca reavaliadas por frame de vídeo (ver comentário em
// filtroCor sobre o porquê disso importar).
const MASCARA_CIRCULO = 'if(lte(pow(X-256,2)+pow(Y-256,2),pow(254,2)),255,0)';
const MASCARA_ARREDONDADA = `if(lte(X,${RAIO})*lte(Y,${RAIO})*gt(pow(X-${RAIO},2)+pow(Y-${RAIO},2),${RAIO_QUAD}),0,`
  + `if(gte(X,${OPOSTO})*lte(Y,${RAIO})*gt(pow(X-${OPOSTO},2)+pow(Y-${RAIO},2),${RAIO_QUAD}),0,`
  + `if(lte(X,${RAIO})*gte(Y,${OPOSTO})*gt(pow(X-${RAIO},2)+pow(Y-${OPOSTO},2),${RAIO_QUAD}),0,`
  + `if(gte(X,${OPOSTO})*gte(Y,${OPOSTO})*gt(pow(X-${OPOSTO},2)+pow(Y-${OPOSTO},2),${RAIO_QUAD}),0,255))))`;

function precisaMascara(estilo) {
  return estilo === 'circle' || estilo === 'rounded';
}

/**
 * Fonte de vídeo sintética (lavfi) que gera a máscara do estilo como uma
 * única imagem em tons de cinza. "-f lavfi -i ..." não precisa de nenhum
 * pipe/arquivo real — o ffmpeg cria o frame internamente.
 */
function mascaraLavfi(estilo) {
  const expr = estilo === 'circle' ? MASCARA_CIRCULO : MASCARA_ARREDONDADA;
  return `color=c=black:s=${TAMANHO}x${TAMANHO}:d=1,format=gray,geq=lum='${expr}'`;
}

/**
 * Filtro aplicado ao vídeo/imagem de verdade — roda em todo frame, então
 * precisa ser barato. Pra circle/rounded, NÃO desenha a máscara aqui (isso
 * seria o filtro "geq" reavaliando a mesma expressão em todo pixel de todo
 * frame — um dos filtros mais lentos do ffmpeg, por ser interpretado, não
 * compilado). A máscara é aplicada depois via alphamerge (ver convertToWebp
 * e buildArgs), que é uma cópia de canal simples, sem expressão nenhuma.
 */
function filtroCor(estilo) {
  if (estilo === 'full') {
    return `scale=${TAMANHO}:${TAMANHO}:force_original_aspect_ratio=decrease,`
      + `pad=${TAMANHO}:${TAMANHO}:(ow-iw)/2:(oh-ih)/2:color=black@0`;
  }
  if (precisaMascara(estilo)) {
    return `scale=${TAMANHO}:${TAMANHO}:force_original_aspect_ratio=increase,crop=${TAMANHO}:${TAMANHO},format=rgba`;
  }
  // "crop" (padrão): cobre o quadro 512x512 inteiro, cortando o que sobrar
  // — sem borda, mas também sem mostrar a imagem completa.
  return `scale=${TAMANHO}:${TAMANHO}:force_original_aspect_ratio=increase,crop=${TAMANHO}:${TAMANHO}`;
}

function runFfmpeg(args, inputBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    const chunks = [];
    let stderr = '';

    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    ffmpeg.stdin.on('error', () => {});

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg não encontrado ou falhou ao iniciar: ${err.message}`));
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        logger.error({ code, stderr: stderr.slice(-2000) }, 'ffmpeg terminou com erro');
        reject(new Error(`ffmpeg saiu com código ${code}`));
        return;
      }
      resolve({ buffer: Buffer.concat(chunks), stderr });
    });

    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}

// Imagens estáticas (foto/print) chegam ao ffmpeg sem timestamps/duração
// (o demuxer jpeg_pipe/png_pipe reporta "Duration: N/A"), então o filtro
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
const RUNG_ESTATICA = { qualidade: 50, fps: 10, compressao: 6 };

// Vídeo/gif é outra história: o webp animado do ffmpeg codifica cada frame
// inteiro (não faz predição entre frames), então o custo — e o tamanho —
// crescem direto com a quantidade de frames. Na prática nenhuma qualidade
// alta cabia nos 480KB, então a escada antiga gastava 4 conversões
// completas pra sempre acabar usando a última: agora ela já começa numa
// qualidade/fps que costuma caber de primeira, e só desce uma vez se
// precisar. compressao=4 em vez de 6 troca alguns KB por uma codificação
// bem mais rápida, que é o gargalo aqui.
const ESCADA_VIDEO = [
  { qualidade: 25, fps: 8, compressao: 4 },
  { qualidade: 12, fps: 6, compressao: 4 },
];

function buildArgs({
  estilo, estatica, duracaoMax, qualidade, fps, compressao,
}) {
  const comMascara = precisaMascara(estilo);
  const filtro = filtroCor(estilo);
  const args = ['-y', '-i', 'pipe:0'];

  if (comMascara) args.push('-f', 'lavfi', '-i', mascaraLavfi(estilo));

  args.push('-t', String(duracaoMax));

  if (comMascara) {
    const cadeiaVideo = estatica ? filtro : `${filtro},fps=${fps}`;
    args.push(
      '-filter_complex',
      // A máscara tem 1 frame só; "loop" repete esse frame indefinidamente
      // pra casar com a quantidade de frames do vídeo real.
      `[0:v]${cadeiaVideo}[cor];[1:v]loop=loop=-1:size=1:start=0[masc];[cor][masc]alphamerge[out]`,
      '-map', '[out]',
    );
  } else {
    args.push('-vf', estatica ? filtro : `${filtro},fps=${fps}`);
  }

  args.push(
    '-vcodec', 'libwebp',
    '-pix_fmt', 'yuva420p',
    '-loop', '0',
    '-an',
    '-vsync', '0',
    '-quality', String(qualidade),
    '-compression_level', String(compressao),
    ...(estatica ? ['-frames:v', '1'] : []),
    '-f', 'webp',
    'pipe:1',
  );

  return args;
}

async function tentarConversao(inputBuffer, opts) {
  const inicio = Date.now();
  try {
    const { buffer, stderr } = await runFfmpeg(buildArgs(opts), inputBuffer);
    if (!isValidWebp(buffer)) {
      logger.error(
        { qualidade: opts.qualidade, bytes: buffer.length, stderr: stderr.slice(-2000) },
        'ffmpeg saiu com código 0 mas não produziu um webp válido',
      );
      return { ok: false, err: new Error('ffmpeg não gerou um webp válido (veja o log "ffmpeg" para detalhes).') };
    }
    logger.info(
      {
        ms: Date.now() - inicio, q: opts.qualidade, fps: opts.fps, kb: Math.round(buffer.length / 1024),
      },
      'conversão ffmpeg',
    );
    return { ok: true, buffer };
  } catch (err) {
    return { ok: false, err };
  }
}

/**
 * Converte um buffer de imagem/vídeo/gif em um buffer webp compatível com
 * o WhatsApp usando o binário ffmpeg do sistema, tudo em memória (sem
 * arquivos temporários). Depende só do ffmpeg, leve de instalar até no
 * Termux (`pkg install ffmpeg`), evitando módulos nativos como o sharp que
 * não têm binários pré-compilados para Android/ARM.
 *
 * estilo: "crop" (padrão, cobre sem borda) | "full" (mostra tudo, com
 * borda transparente) | "circle" (círculo) | "rounded" (cantos
 * arredondados).
 */
async function convertToWebp(inputBuffer, { estilo = 'crop', duracaoMax = 6 } = {}) {
  const estatica = isImagemEstatica(inputBuffer);

  if (estatica) {
    const resultado = await tentarConversao(inputBuffer, {
      estilo, estatica, duracaoMax, ...RUNG_ESTATICA,
    });
    if (resultado.ok) return resultado.buffer;
    throw resultado.err;
  }

  let ultimoErro;
  let ultimoBuffer;
  for (const rung of ESCADA_VIDEO) {
    // eslint-disable-next-line no-await-in-loop -- de propósito: só cai
    // pra próxima qualidade se a anterior não couber. Rodar as duas
    // sempre (em série ou em paralelo) seria gastar CPU à toa, e num
    // celular paralelizar trabalho preso em CPU não ganha tempo nenhum:
    // os processos só disputam os mesmos núcleos.
    const resultado = await tentarConversao(inputBuffer, {
      estilo, estatica, duracaoMax, ...rung,
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
}

module.exports = { convertToWebp };
