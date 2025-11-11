import { workerData, parentPort } from 'worker_threads';
import fetch from 'node-fetch';

(async () => {
  try {
    const { prompt } = workerData;
    if (!prompt) throw new Error('No se recibió descripción');

    // Usamos una API pública de imágenes (rápida y sin bloqueo)
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error('No se pudo generar imagen');
    const buffer = await res.arrayBuffer();

    parentPort.postMessage({ base64: Buffer.from(buffer).toString('base64') });
  } catch (err) {
    console.error('🧠 Error en imageWorker:', err.message);
    parentPort.postMessage({ error: err.message });
  } finally {
    process.exit(0);
  }
})();
