import { Worker } from 'worker_threads';
const MAX_WORKERS = 4; // Puedes aumentar según CPU
const queue = [];
let activeWorkers = 0;

export function enqueueSticker(mediaData) {
  return new Promise((resolve, reject) => {
    queue.push({ mediaData, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (queue.length === 0 || activeWorkers >= MAX_WORKERS) return;

  const { mediaData, resolve, reject } = queue.shift();
  activeWorkers++;

  const worker = new Worker('./workers/stickerWorker.js', { workerData: { mediaData } });
  worker.on('message', msg => msg.error ? reject(msg.error) : resolve(msg));
  worker.on('error', reject);
  worker.on('exit', () => {
    activeWorkers--;
    processQueue();
  });
}
