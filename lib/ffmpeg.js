const { spawn } = require('child_process');
const { createLogger } = require('./logger');

const logger = createLogger('ffmpeg');

// Encaixa em um canvas 512x512 (tamanho de figurinha do WhatsApp), mantendo
// a proporção, preenchendo com fundo transparente.
const WEBP_FILTER = 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,'
  + 'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1';

/**
 * Converte um buffer de imagem/vídeo/gif em um buffer webp compatível com
 * o WhatsApp usando o binário ffmpeg do sistema, tudo em memória (sem
 * arquivos temporários). Depende só do ffmpeg, leve de instalar até no
 * Termux (`pkg install ffmpeg`), evitando módulos nativos como o sharp que
 * não têm binários pré-compilados para Android/ARM.
 */
function convertToWebp(inputBuffer) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', 'pipe:0',
      '-t', '7',
      '-vf', WEBP_FILTER,
      '-vcodec', 'libwebp',
      '-pix_fmt', 'yuva420p',
      '-loop', '0',
      '-an',
      '-vsync', '0',
      '-quality', '75',
      '-f', 'webp',
      'pipe:1',
    ];

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
        logger.error({ code, stderr: stderr.slice(-2000) }, 'ffmpeg exited with an error');
        reject(new Error(`ffmpeg saiu com código ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}

module.exports = { convertToWebp };
