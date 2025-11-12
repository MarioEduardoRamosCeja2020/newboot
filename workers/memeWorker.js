import { parentPort } from 'worker_threads';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FALLBACK_MEME = path.join(__dirname, '../assets/fallback.jpg');

// Cache de memes pre-cargados
let memeCache = [];

// Función para obtener meme de meme-api.com
async function getFromMemeApi() {
  try {
    const res = await fetch('https://meme-api.com/gimme');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.url) return null;
    const buffer = Buffer.from(await (await fetch(data.url)).arrayBuffer());
    return buffer;
  } catch { return null; }
}

// Función para obtener meme de some-random-api.ml
async function getFromSomeRandom() {
  try {
    const res = await fetch('https://some-random-api.ml/meme');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.image) return null;
    const buffer = Buffer.from(await (await fetch(data.image)).arrayBuffer());
    return buffer;
  } catch { return null; }
}

// Función para obtener meme de imgflip
async function getFromImgflip() {
  try {
    const res = await fetch('https://api.imgflip.com/get_memes');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.data?.memes?.length) return null;
    const memes = data.data.memes;
    const meme = memes[Math.floor(Math.random() * memes.length)];
    if (!meme?.url) return null;
    const buffer = Buffer.from(await (await fetch(meme.url)).arrayBuffer());
    return buffer;
  } catch { return null; }
}

// Obtener meme (cache > API1 > API2 > API3 > fallback)
async function getMeme() {
  if (memeCache.length > 0) {
    const buffer = memeCache.shift();
    // pre-cargar otro en segundo plano
    fetchMeme().then(b => b && memeCache.push(b));
    return buffer;
  }

  const buffer = await fetchMeme();
  if (buffer) return buffer;

  // fallback local
  return fs.readFileSync(FALLBACK_MEME);
}

// Función que intenta todas las fuentes
async function fetchMeme() {
  const funcs = [getFromMemeApi, getFromSomeRandom, getFromImgflip];
  for (const fn of funcs) {
    const buffer = await fn();
    if (buffer) return buffer;
  }
  return null;
}

(async () => {
  try {
    const buffer = await getMeme();
    const tmpFile = path.join(os.tmpdir(), `meme-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, buffer);
    const base64 = buffer.toString('base64');
    parentPort.postMessage({ base64, tmpFile });
  } catch (err) {
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
