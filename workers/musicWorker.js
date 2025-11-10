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
    const results = await GetListByKeyword(query, false, 1);
    if (!results?.items?.length) throw new Error('No encontrado');

    const video = results.items[0];
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const tempFile = `./temp_${Date.now()}.mp3`;

    await new Promise((resolve, reject) => {
      const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
      ffmpeg(stream)
        .audioBitrate(128)
        .save(tempFile)
        .on('end', resolve)
        .on('error', reject);
    });

    parentPort.postMessage({ file: tempFile, title: video.title });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
