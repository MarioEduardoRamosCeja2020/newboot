// workers/stickerWorker.js
import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import os from 'os';

(async () => {
    try {
            const buffer = Buffer.from(media.data, 'base64');
    const tmpFile = path.join(os.tmpdir(), `sticker-${Date.now()}.webp`);
     await sharp(buffer)
     .webp({ quality: 90 })
      .toFile(tmpFile);

       parentPort.postMessage({ webp: webpBase64, tmpFile });
         } catch (err) {
             parentPort.postMessage({ error: err.message });
  }
})();