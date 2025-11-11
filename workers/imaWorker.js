// workers/imageWorker.js
import { parentPort, workerData } from 'worker_threads';
import { generateImage } from '../lib/imageAPI.js'; // tu API de imágenes
import fs from 'fs';
import path from 'path';
import os from 'os';

(async () => {
  try {
    const prompt = workerData.prompt;
    const tmpFile = path.join(os.tmpdir(), `img-${Date.now()}.jpg`);

    const base64 = await generateImage(prompt); // Devuelve base64
    fs.writeFileSync(tmpFile, Buffer.from(base64, 'base64'));

    parentPort.postMessage({ base64, tmpFile });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
