import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    const { mediaArray } = workerData;
    const webpArray = [];
    const tmpFiles = [];

    for (const media of mediaArray) {
      const tmpFile = path.join('./tmp', `sticker-pol-${Date.now()}.webp`);
      tmpFiles.push(tmpFile);
      const buffer = Buffer.from(media.data, 'base64');
      await sharp(buffer)
        .resize(512, 512, { fit: 'contain' })
        .webp()
        .toFile(tmpFile);
      webpArray.push(fs.readFileSync(tmpFile, { encoding: 'base64' }));
    }

    parentPort.postMessage({ webpArray, tmpFiles });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
