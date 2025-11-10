import { workerData, parentPort } from 'worker_threads';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import { GetListByKeyword } from 'youtube-search-api';

ffmpeg.setFfmpegPath(ffmpegPath);

(async () => {
  try {
    const { query } = workerData;
    if (!query || query.length < 2) throw new Error('No se proporcionó nombre de canción');

    // Buscar video en YouTube
    const results = await GetListByKeyword(query, false, 5); // buscamos 5 resultados
    if (!results?.items?.length) throw new Error('No se encontró la canción');

    const video = results.items[0];
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const tempFile = `./temp_${Date.now()}.mp3`;

    // Descargar audio y convertirlo a mp3
    await new Promise((resolve, reject) => {
      const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
      ffmpeg(stream)
        .audioBitrate(128)
        .format('mp3')
        .save(tempFile)
        .on('end', resolve)
        .on('error', reject);
    });

    parentPort.postMessage({ file: tempFile, title: video.title });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
