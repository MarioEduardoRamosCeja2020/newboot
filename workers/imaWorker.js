import { workerData, parentPort } from 'worker_threads';
import OpenAI from 'openai';

(async () => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { prompt } = workerData;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '512x512'
    });

    const imageBase64 = response.data[0].b64_json;
    parentPort.postMessage({ base64: imageBase64 });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();
