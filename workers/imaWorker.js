import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    const { media } = workerData;
    const tmpFile = path.join('./tmp', `ima-${Date.now()}.png`);
    const buffer = Buffer.from(media.data, 'base64');

    await sharp(buffer)
      .resize(800)
      .grayscale()
      .toFile(tmpFile);

    const base64 = fs.readFileSync(tmpFile, { encoding: 'base64' });
    parentPort.postMessage({ base64, tmpFile });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
