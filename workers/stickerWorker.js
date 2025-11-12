import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import os from 'os';

(async () => {
  try {
    const { media } = workerData;
    if (!media || !media.data || !media.mimetype) throw new Error('No media recibido');

    const buffer = Buffer.from(media.data, 'base64');
    const tmpFile = path.join(os.tmpdir(), `sticker-${Date.now()}.webp`);

    if (media.mimetype === 'image/gif') {
      // GIF animado → WebP animado
      await sharp(buffer, { animated: true })
        .webp({ quality: 90, effort: 6, animated: true })
        .toFile(tmpFile);
    } else if (media.mimetype.startsWith('image/')) {
      // Imagen normal → WebP
      await sharp(buffer)
        .resize({ width: 512, height: 512, fit: 'inside' })
        .webp({ quality: 90 })
        .toFile(tmpFile);
    } else {
      throw new Error('Solo se pueden generar stickers a partir de imágenes o GIFs');
    }

    const webpBuffer = fs.readFileSync(tmpFile);
    const webpBase64 = webpBuffer.toString('base64');

    parentPort.postMessage({ webp: webpBase64, tmpFile });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
