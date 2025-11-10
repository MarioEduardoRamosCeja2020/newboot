import { workerData, parentPort } from 'worker_threads';
import sharp from 'sharp';

(async () => {
  try {
    const { mediaData, text } = workerData;
    if (!mediaData || !mediaData.data) throw new Error('No media');

    const buffer = Buffer.from(mediaData.data, 'base64');
    const customText = text || 'Solo en Desterra2 Papu';
    const fontSize = customText.length > 25 ? 28 : 36;

    const processed = await sharp(buffer)
      .resize(512, 512, { fit: 'cover' })
      .composite([{
        input: Buffer.from(`
          <svg width="512" height="512">
            <rect x="0" y="450" width="512" height="62" fill="rgba(0,0,0,0.4)" />
            <text x="50%" y="495" font-size="${fontSize}" font-family="Arial Black"
            fill="white" stroke="black" stroke-width="2" text-anchor="middle">${customText}</text>
          </svg>
        `),
        gravity: 'south'
      }])
      .webp()
      .toBuffer();

    parentPort.postMessage({ webp: processed.toString('base64') });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
