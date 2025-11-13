// workers/stickerWorker.js
const { parentPort, workerData } = require('worker_threads');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createSticker(imageBuffer) {
  const outputPath = path.join(__dirname, '../tmp', `sticker_${Date.now()}.webp`);

  // Usamos Sharp para crear el sticker
  await sharp(imageBuffer)
    .resize(512, 512) // Redimensionar
    .webp()  // Convertir a WebP
    .toFile(outputPath);

  return outputPath;
}

createSticker(workerData.imageBuffer)
  .then(outputPath => {
    parentPort.postMessage({ status: 'success', outputPath });
  })
  .catch(err => {
    parentPort.postMessage({ status: 'error', error: err.message });
  });
