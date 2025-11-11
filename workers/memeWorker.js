// workers/memeWorker.js
import { parentPort } from 'worker_threads';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

(async () => {
  try {
    const res = await fetch('https://meme-api.com/gimme');
    const data = await res.json();
    const imageUrl = data.url;

    const imageRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imageRes.arrayBuffer());

    const tmpFile = path.join(os.tmpdir(), `meme-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, buffer);

    const base64 = buffer.toString('base64');
    parentPort.postMessage({ base64, tmpFile });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
