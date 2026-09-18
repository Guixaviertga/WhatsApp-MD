const { spawn } = require('child_process');
const { createLogger } = require('./logger');

const logger = createLogger('ffmpeg');

// Fit into a 512x512 canvas (WhatsApp's sticker size), keeping aspect ratio,
// padded with a transparent background.
const WEBP_FILTER = 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,'
  + 'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1';

/**
 * Converts an image/video/gif buffer into a WhatsApp-compatible webp buffer
 * using the system's ffmpeg binary, entirely in memory (no temp files).
 * Relies only on ffmpeg, which is lightweight to install even on Termux
 * (`pkg install ffmpeg`), avoiding native modules like sharp that lack
 * prebuilt binaries for Android/ARM.
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
    ffmpeg.stdin.on('error', () => {}); // avoid crashing on EPIPE if ffmpeg exits early

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
