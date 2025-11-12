import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import sharp from 'sharp';

// ---------------------------
// Config
// ---------------------------
const TMP_DIR = './tmp';
const LOG_FILE = './logs/bot.log';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');

// ---------------------------
// Logging
// ---------------------------
function logEvent(type, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${type}] ${message} ${Object.keys(data).length ? JSON.stringify(data) : ''}\n`;
  fs.appendFile(LOG_FILE, logLine, err => { if (err) console.error('⚠️ Error guardando log:', err); });
  console.log(`${type === 'ERROR' ? '💥' : '🧠'} ${message}`);
}

// ---------------------------
// Utils
// ---------------------------
const isValidUserId = id => typeof id === 'string' && id.includes('@');
const deleteTmpFile = filePath => { if (filePath) fs.unlink(filePath, err => {}); };

// ---------------------------
// Queue de Workers
// ---------------------------
const queues = { sticker: [] };
const activeWorkers = { sticker: 0 };
function enqueue(type, workerFile, workerData) {
  return new Promise((resolve, reject) => {
    queues[type].push({ workerFile, workerData, resolve, reject });
    processQueue(type);
  });
}
function processQueue(type) {
  if (!queues[type].length) return;
  const { workerFile, workerData, resolve, reject } = queues[type].shift();
  activeWorkers[type]++;
  const worker = new Worker(workerFile, { workerData });
  worker.on('message', msg => resolve(msg));
  worker.on('error', err => reject(err));
  worker.on('exit', () => {
    activeWorkers[type]--;
    processQueue(type);
  });
}

// ---------------------------
// Enviar mensajes seguros
// ---------------------------
async function sendSafeMessageRandom(chat, text, mentions, batchSize = 5, minDelay = 1500, maxDelay = 3500) {
  for (let i = 0; i < mentions.length; i += batchSize) {
    const batch = mentions.slice(i, i + batchSize);
    try {
      await chat.sendMessage(`${text}\n${batch.map(m => `@${m.split('@')[0]}`).join(' ')}`, { mentions: batch });
    } catch (err) {
      logEvent('ERROR', 'Error enviando mensaje batch', { error: err.message });
    }
    const delay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
    await new Promise(res => setTimeout(res, delay));
  }
}

// ---------------------------
// Cliente WhatsApp
// ---------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot', dataPath: './session_data' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', async () => {
  logEvent('INFO', '😎🐐 Bot Turbo Pro listo');
  try {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    for (const group of groups) {
      try { await group.sendMessage('😎🐐 Bot activo y listo'); } catch {}
    }
  } catch {}
});

// ---------------------------
// Mensajes entrantes
// ---------------------------
client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();
  let chat;
  try { chat = await msg.getChat(); } catch { return; }

  try {
    // ---------------------------
    // Sticker automático seguro + redimensionamiento
    // ---------------------------
    if (msg.hasMedia) {
      try {
        let media = await msg.downloadMedia();

        if (
          media &&
          media.data &&
          media.mimetype?.startsWith('image/') &&
          !media.filename?.endsWith('.webp') &&
          !media.mimetype.includes('gif')
        ) {
          // Convertimos base64 a Buffer para Sharp
          let imgBuffer = Buffer.from(media.data, 'base64');

          // Redimensionar si es mayor a 512x512
          const metadata = await sharp(imgBuffer).metadata();
          if (metadata.width > 512 || metadata.height > 512) {
            imgBuffer = await sharp(imgBuffer)
              .resize({ width: 512, height: 512, fit: 'inside' })
              .toBuffer();
            media.data = imgBuffer.toString('base64');
          }

          enqueue('sticker', './workers/stickerWorker.js', { media })
            .then(async ({ webp, tmpFile }) => {
              try {
                if (webp) {
                  const stickerMedia = new MessageMedia('image/webp', webp);
                  await chat.sendMessage(stickerMedia, { sendMediaAsSticker: true });
                }
              } catch (err) {
                logEvent('ERROR', 'Error enviando sticker', { error: err.message });
              } finally {
                deleteTmpFile(tmpFile);
              }
            })
            .catch(err => logEvent('ERROR', 'Sticker Worker falló', { error: err.message }));
        } else {
          logEvent('INFO', 'Media ignorada (no es imagen estática compatible)');
        }
      } catch (err) {
        logEvent('ERROR', 'Error descargando o procesando media', { error: err.message });
      }
      return;
    }

    // ---------------------------
    // Comando de menú
    // ---------------------------
    if (command === '.bot') {
      try {
        await chat.sendMessage(`
🎉 MENÚ DEL BOT 🎉
💬 *.bot* — Mostrar menú
👥 *.todos* — Etiquetar a todos
🙈 *.hidetag <msg>* — Mensaje oculto
📣 *.notify <msg>* — Aviso general
`);
      } catch {}
      return;
    }

    // ---------------------------
    // Comando .todos
    // ---------------------------
    if (command === '.todos') {
      try {
        const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
        await sendSafeMessageRandom(chat, '📣 INVOCACIÓN:', mentions);
      } catch {}
      return;
    }

    // ---------------------------
    // Comando .hidetag
    // ---------------------------
    if (command === '.hidetag') {
      try {
        const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
        await sendSafeMessageRandom(chat, text || 'Mensaje oculto:', mentions, 10, 1200, 3000);
      } catch {}
      return;
    }

    // ---------------------------
    // Comando .notify
    // ---------------------------
    if (command === '.notify') {
      try {
        const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
        await sendSafeMessageRandom(chat, `📢 ${text || 'Aviso general'}`, mentions, 8, 1500, 4000);
      } catch {}
      return;
    }

  } catch (err) {
    logEvent('ERROR', 'Error general', { error: err.message });
    try { await chat.sendMessage('⚠️ Error interno, pero sigo activo 😎'); } catch {}
  }
});

client.initialize();

// ---------------------------
// Express
// ---------------------------
const app = express();
app.get('/', (_, res) => res.send('😎 Bot Turbo Pro corriendo'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => logEvent('INFO', '🌐 Servidor Express activo'));
