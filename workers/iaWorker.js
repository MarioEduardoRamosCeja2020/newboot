import { parentPort, workerData } from 'worker_threads';

(async () => {
  try {
    const { prompt } = workerData;
    // Simulación de IA
    const response = `🤖 IA dice: "${prompt}"`;
    parentPort.postMessage({ response });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
