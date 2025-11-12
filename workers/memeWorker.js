// workers/memeWorker.js
import { parentPort } from 'worker_threads';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

(async () => {
  try {
    // Traer meme aleatorio de la API
    const res = await fetch('https://meme-api.com/gimme');
    if (!res.ok) throw new Error(`Error al obtener meme: ${res.statusText}`);
    const data = await res.json();

    if (!data.url) throw new Error('No se obtuvo URL del meme');

    const imageUrl = data.url;

    // Descargar la imagen
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`Error descargando imagen: ${imageRes.statusText}`);
    const buffer = Buffer.from(await imageRes.arrayBuffer());

    // Guardar temporalmente
    const tmpFile = path.join(os.tmpdir(), `meme-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, buffer);

    // Convertir a base64 para enviar con WhatsApp
    const base64 = buffer.toString('base64');

    parentPort.postMessage({ base64, tmpFile });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
