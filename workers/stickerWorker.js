// workers/stickerWorker.js
import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import os from 'os';

(async () => {
  const cleanup = f => f && fs.existsSync(f) && fs.unlink(f, () => {});
  const { media } = workerData;

  try {
    if (!media?.data) throw new Error('No se recibió media');
    if (!media.mimetype?.startsWith('image/')) throw new Error('El archivo no es una imagen válida');
    if (media.mimetype.includes('webp')) throw new Error('Ya es un sticker, no se procesa');

    // Convertimos el base64 en buffer
    const buffer = Buffer.from(media.data, 'base64');
    const tmpFile = path.join(os.tmpdir(), `sticker-${Date.now()}.webp`);

    // Procesamos con sharp (rápido y eficiente)
    await sharp(buffer)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(tmpFile);

    // Leemos el archivo generado y devolvemos base64
    const webpBase64 = fs.readFileSync(tmpFile, 'base64');

    parentPort.postMessage({ webp: webpBase64, tmpFile });
    cleanup(tmpFile);
  } catch (err) {
    console.error('❌ Error en stickerWorker:', err.message);
    parentPort.postMessage({ error: err.message });
  }
})();
