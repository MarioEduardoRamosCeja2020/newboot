import { parentPort } from 'worker_threads';
import fetch from 'node-fetch';

(async () => {
  try {
    // Ejemplo simple usando API pública de memes
    const res = await fetch('https://meme-api.com/gimme');
    const data = await res.json();

    if (!data || !data.url) throw new Error('No se pudo obtener meme');

    // Convertimos la imagen a base64
    const imgRes = await fetch(data.url);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    parentPort.postMessage({ base64 });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
