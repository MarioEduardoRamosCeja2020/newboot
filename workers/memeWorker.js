import { parentPort } from 'worker_threads';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Meme fallback local
const FALLBACK_MEME = path.join(__dirname, '../assets/fallback.jpg');

// Cache en memoria
let memeCache = [];

// Función para cargar memes desde la API
async function fetchMeme() {
  try {
    let imageUrl = null;

    // API principal
    try {
      const res = await fetch('https://meme-api.com/gimme');
      if (res.ok) {
        const data = await res.json();
        if (data?.url) imageUrl = data.url;
      }
    } catch {}

    // Segunda API
    if (!imageUrl) {
      try {
        const res2 = await fetch('https://some-random-api.ml/meme');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2?.image) imageUrl = data2.image;
        }
      } catch {}
    }

    if (!imageUrl) return null;

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error('Error descargando imagen');
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return buffer;
  } catch {
    return null;
  }
}

// Función para obtener meme (cache > API > fallback local)
async function getMeme() {
  if (memeCache.length > 0) {
    // Sacar el primero del cache
    const buffer = memeCache.shift();
    // Pre-cargar otro en segundo plano
    fetchMeme().then(b => b && memeCache.push(b));
    return buffer;
  }

  // No hay cache: intentar API
  const buffer = await fetchMeme();
  if (buffer) {
    // Pre-cargar otro
    fetchMeme().then(b => b && memeCache.push(b));
    return buffer;
  }

  // Fallback local
  return fs.readFileSync(FALLBACK_MEME);
}

// Worker principal
(async () => {
  try {
    const buffer = await getMeme();
    const tmpFile = path.join(os.tmpdir(), `meme-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, buffer);

    const base64 = buffer.toString('base64');
    parentPort.postMessage({ base64, tmpFile });
  } catch (err) {
    // Último recurso: fallback local
    try {
      const buffer = fs.readFileSync(FALLBACK_MEME);
      const tmpFile = FALLBACK_MEME;
      const base64 = buffer.toString('base64');
      parentPort.postMessage({ base64, tmpFile });
    } catch {
      parentPort.postMessage({ error: 'No se pudo obtener ningún meme 😅' });
    }
  }
})();
