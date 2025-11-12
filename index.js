import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
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
// Utilidades
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
// Enviar mensajes de manera segura
// ---------------------------
async function sendSafeMessageRandom(chat, text, mentions, batchSize = 5, minDelay = 1500, maxDelay = 3500) {
  try {
    for (let i = 0; i < mentions.length; i += batchSize) {
      const batch = mentions.slice(i, i + batchSize);
      try {
        await chat.sendMessage(`${text}\n${batch.map(m => `@${m.split('@')[0]}`).join(' ')}`, { mentions: batch });
      } catch {}
      const delay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
      await new Promise(res => setTimeout(res, delay));
    }
  } catch {}
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

client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();
  let chat;
  try { chat = await msg.getChat(); } catch { return; }

  try {
    // ---------------------------
    // Sticker automático seguro
    // ---------------------------
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media.mimetype?.startsWith('image/') && !media.filename?.endsWith('.webp')) {
          enqueue('sticker', './workers/stickerWorker.js', { media })
            .then(({ webp, tmpFile }) => {
              try { chat.sendMessage(new MessageMedia('image/webp', webp), { sendMediaAsSticker: true }); } catch {}
              deleteTmpFile(tmpFile);
            })
            .catch(err => logEvent('ERROR', 'Sticker falló', { error: err.message }));
        }
      } catch {}
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
