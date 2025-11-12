// workers/stickerWorker.js
import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import os from 'os';

(async () => {
  try {
    const { media } = workerData;
    const buffer = Buffer.from(media.data, 'base64');
    const tmpFile = path.join(os.tmpdir(), `sticker-${Date.now()}.webp`);

    // Detectamos tipo de archivo
    const isGif = media.mimetype === 'image/gif';

    if (isGif) {
      // GIF animado → WebP animado
      await sharp(buffer, { animated: true })
        .webp({ quality: 90, effort: 6, animated: true })
        .toFile(tmpFile);
    } else {
      // Imagen normal → WebP
      await sharp(buffer)
        .resize({ width: 512, height: 512, fit: 'inside' })
        .webp({ quality: 90 })
        .toFile(tmpFile);
    }

    // Leemos el archivo resultante y lo convertimos a Base64
    const webpBuffer = fs.readFileSync(tmpFile);
    const webpBase64 = webpBuffer.toString('base64');

    parentPort.postMessage({ webp: webpBase64, tmpFile });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
