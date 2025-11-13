// workers/memeWorker.js
import { parentPort, workerData } from 'worker_threads';
import fetch from 'node-fetch';
import { MessageMedia } from 'baileys'; // Usamos baileys para enviar el mensaje

// Función para obtener el meme de las APIs
async function getRandomMemeUrl() {
  const apis = [
    async () => { // Imgflip
      const res = await fetch('https://api.imgflip.com/get_memes');
      const j = await res.json();
      if (j.success && j.data.memes.length) {
        const memes = j.data.memes;
        const m = memes[Math.floor(Math.random() * memes.length)];
        return m.url;
      }
      throw new Error('Imgflip no disponible');
    },
    async () => { // MemesAPI
      const res = await fetch('https://memesapi.vercel.app/api/memes/random');
      const j = await res.json();
      if (j && j.image) return j.image;
      throw new Error('MemesAPI no disponible');
    },
    async () => { // Memegen
      return 'https://api.memegen.link/images/random'; // Devuelve URL directa
    }
  ];

  for (const apiFn of apis) {
    try {
      const url = await apiFn();
      return url;
    } catch (err) {
      console.warn('Fallo API meme:', err.message);
      continue;
    }
  }
  throw new Error('Todas las APIs de memes fallaron');
}

// Función principal para manejar el worker
async function generateMeme() {
  try {
    // Obtener URL de meme aleatorio
    const memeUrl = await getRandomMemeUrl();

    // Descargar la imagen del meme
    const response = await fetch(memeUrl);
    const buffer = await response.buffer(); // Obtener la imagen como buffer

    // Crear un mensaje de tipo media para enviarlo con Baileys
    const media = new MessageMedia('image/jpeg', buffer.toString('base64'));

    parentPort.postMessage({ status: 'success', media });
  } catch (err) {
    parentPort.postMessage({ status: 'error', error: err.message });
  }
}

// Ejecutar la función para generar el meme
generateMeme();
