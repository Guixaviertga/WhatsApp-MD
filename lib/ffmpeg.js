const { spawn } = require('child_process');
const { createLogger } = require('./logger');

const logger = createLogger('ffmpeg');

const TAMANHO = 512;
const RAIO = 64;
const OPOSTO = TAMANHO - RAIO;
const RAIO_QUAD = RAIO * RAIO;

// Máscara alpha com os 4 cantos arredondados (raio de 64px num quadro
// 512x512): fora do raio, em cada canto, o pixel vira transparente.
const FILTRO_ARREDONDADO = `scale=${TAMANHO}:${TAMANHO}:force_original_aspect_ratio=increase,crop=${TAMANHO}:${TAMANHO},format=rgba,`
  + `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(X,${RAIO})*lte(Y,${RAIO})*gt(pow(X-${RAIO},2)+pow(Y-${RAIO},2),${RAIO_QUAD}),0,`
  + `if(gte(X,${OPOSTO})*lte(Y,${RAIO})*gt(pow(X-${OPOSTO},2)+pow(Y-${RAIO},2),${RAIO_QUAD}),0,`
  + `if(lte(X,${RAIO})*gte(Y,${OPOSTO})*gt(pow(X-${RAIO},2)+pow(Y-${OPOSTO},2),${RAIO_QUAD}),0,`
  + `if(gte(X,${OPOSTO})*gte(Y,${OPOSTO})*gt(pow(X-${OPOSTO},2)+pow(Y-${OPOSTO},2),${RAIO_QUAD}),0,255))))'`;

// Máscara alpha circular: fora do raio de 254px do centro, transparente.
const FILTRO_CIRCULO = `scale=${TAMANHO}:${TAMANHO}:force_original_aspect_ratio=increase,crop=${TAMANHO}:${TAMANHO},format=rgba,`
  + "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow(X-256,2)+pow(Y-256,2),pow(254,2)),255,0)'";

/**
 * Filtro base de cada estilo, sem o "fps" (que varia conforme a tentativa
 * na escada de qualidade — ver convertToWebp).
 */
function filtroBase(estilo) {
  if (estilo === 'full') {
    return `scale=${TAMANHO}:${TAMANHO}:force_original_aspect_ratio=decrease,`
      + `pad=${TAMANHO}:${TAMANHO}:(ow-iw)/2:(oh-ih)/2:color=black@0`;
  }
  if (estilo === 'circle') return FILTRO_CIRCULO;
  if (estilo === 'rounded') return FILTRO_ARREDONDADO;
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
// pra enviar/exibir acima disso. Se a primeira tentativa (melhor
// qualidade) passar do limite, cai pra qualidade/fps menores até caber —
// ou usa a última tentativa mesmo assim, se nenhuma couber.
const LIMITE_BYTES = 480 * 1024;
const ESCADA_QUALIDADE = [
  { qualidade: 50, fps: 10 },
  { qualidade: 35, fps: 10 },
  { qualidade: 25, fps: 8 },
  { qualidade: 15, fps: 6 },
];

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
async function convertToWebp(inputBuffer, { estilo = 'crop', duracaoMax = 10 } = {}) {
  const filtro = filtroBase(estilo);

  let ultimoErro;
  for (const { qualidade, fps } of ESCADA_QUALIDADE) {
    const args = [
      '-y',
      '-i', 'pipe:0',
      '-t', String(duracaoMax),
      '-vf', `${filtro},fps=${fps}`,
      '-vcodec', 'libwebp',
      '-pix_fmt', 'yuva420p',
      '-loop', '0',
      '-an',
      '-vsync', '0',
      '-quality', String(qualidade),
      '-compression_level', '6',
      '-f', 'webp',
      'pipe:1',
    ];

    try {
      // eslint-disable-next-line no-await-in-loop -- tentativas dependem
      // do tamanho da anterior; não faz sentido rodar em paralelo.
      const { buffer, stderr } = await runFfmpeg(args, inputBuffer);
      const ultimaTentativa = qualidade === ESCADA_QUALIDADE[ESCADA_QUALIDADE.length - 1].qualidade;

      if (!isValidWebp(buffer)) {
        logger.error(
          { qualidade, bytes: buffer.length, stderr: stderr.slice(-2000) },
          'ffmpeg saiu com código 0 mas não produziu um webp válido',
        );
        ultimoErro = new Error('ffmpeg não gerou um webp válido (veja o log "ffmpeg" para detalhes).');
        continue;
      }

      if (buffer.length <= LIMITE_BYTES || ultimaTentativa) return buffer;
    } catch (err) {
      ultimoErro = err;
    }
  }

  throw ultimoErro || new Error('não foi possível gerar a figurinha.');
}

module.exports = { convertToWebp };
