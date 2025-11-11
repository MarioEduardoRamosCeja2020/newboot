// workers/musicWorker.js
import { parentPort, workerData } from 'worker_threads';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

(async () => {
  try {
    const query = workerData.query;
    // Para simplificar: usar búsqueda de YouTube
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    // Esto requiere un método que obtenga el primer videoId
    const videoId = await getFirstYouTubeVideoId(searchUrl); 
    const tmpFile = path.join(os.tmpdir(), `music-${Date.now()}.mp3`);

    const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { filter: 'audioonly' });
    const writeStream = fs.createWriteStream(tmpFile);
    stream.pipe(writeStream);

    writeStream.on('finish', () => {
      parentPort.postMessage({ file: tmpFile, title: query });
    });

    stream.on('error', err => {
      parentPort.postMessage({ error: err.message });
    });

  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();

// Función auxiliar para obtener videoId (puedes usar 'yt-search' o 'ytsr')
async function getFirstYouTubeVideoId(url) {
  const ytsr = await import('ytsr');
  const searchResults = await ytsr.default(url, { limit: 1 });
  return searchResults.items[0].id;
}
