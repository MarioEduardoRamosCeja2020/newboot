import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';

const TMP_DIR = './tmp';
const LOG_DIR = './logs';
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// ---------------------------
// Logging
// ---------------------------
function log(type, msg, data = {}) {
  const time = new Date().toISOString();
  const line = `[${time}] [${type}] ${msg} ${Object.keys(data).length ? JSON.stringify(data) : ''}\n`;
  fs.appendFile(LOG_FILE, line, () => {});
  console.log(`${type === 'ERROR' ? '💥' : '🧠'} ${msg}`);
}

// ---------------------------
// Helpers
// ---------------------------
const isValidId = id => typeof id === 'string' && id.includes('@');
const deleteTmp = file => { if (file) fs.unlink(file, () => {}); };

async function batchSend(chat, text, mentions, batchSize = 10, minDelay = 1200, maxDelay = 3500) {
  for (let i = 0; i < mentions.length; i += batchSize) {
    const batch = mentions.slice(i, i + batchSize);
    try {
      await chat.sendMessage(`${text}\n${batch.map(m => `@${m.split('@')[0]}`).join(' ')}`, { mentions: batch });
    } catch {}
    const delay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
    await new Promise(r => setTimeout(r, delay));
  }
}

// ---------------------------
// Worker queue
// ---------------------------
const queues = { sticker: [], meme: [] };
const activeWorkers = { sticker: 0, meme: 0 };

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
  worker.on('exit', () => { activeWorkers[type]--; processQueue(type); });
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
  log('INFO', '😎🐐 Bot Pro listo');
  try {
    const chats = await client.getChats();
    for (const group of chats.filter(c => c.isGroup)) {
      try { await group.sendMessage('⚡ Bot Pro activo y listo para el grupo 😎'); } catch {}
    }
  } catch {}
});

// ---------------------------
// Manejo de mensajes
// ---------------------------
client.on('message', async msg => {
  const body = msg.body || '';
  const args = body.trim().split(' ');
  const cmd = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();
  let chat;
  try { chat = await msg.getChat(); } catch { return; }

  try {
    // Sticker automático solo para imágenes
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media.mimetype?.startsWith('image/') && !media.filename?.endsWith('.webp')) {
          enqueue('sticker', './workers/stickerWorker.js', { media })
            .then(({ webp, tmpFile }) => {
              try { chat.sendMessage(new MessageMedia('image/webp', webp), { sendMediaAsSticker: true }); } catch {}
              deleteTmp(tmpFile);
            })
            .catch(err => log('ERROR', 'Sticker falló', { error: err.message }));
        }
      } catch {}
      return;
    }

    // ---------------------------
    // Menú bonito
    // ---------------------------
    if (cmd === '.bot') {
      const menu = `
🌟 *😎🐐 Bot Pro - MENÚ* 🌟
────────────────────────────
💬 *.bot* — Mostrar menú
👥 *.todos* — Etiquetar a todos
🙈 *.hidetag <mensaje>* — Mensaje oculto
📣 *.notify <mensaje>* — Aviso general
🎲 *.parejas* — Formar parejas
🤣 *.meme* — Enviar meme random
────────────────────────────
⚡ _Rápido, seguro y activo_ ⚡
`;
      try { await chat.sendMessage(menu); } catch {}
      return;
    }

    // ---------------------------
    // .todos
    // ---------------------------
    if (cmd === '.todos') {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidId);
      await batchSend(chat, '📣 INVOCACIÓN:', mentions);
      return;
    }

    // ---------------------------
    // .hidetag
    // ---------------------------
    if (cmd === '.hidetag') {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidId);
      await batchSend(chat, text || 'Mensaje oculto:', mentions, 10, 1200, 3000);
      return;
    }

    // ---------------------------
    // .notify
    // ---------------------------
    if (cmd === '.notify') {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidId);
      await batchSend(chat, `📢 ${text || 'Aviso general'}`, mentions, 8, 1500, 4000);
      return;
    }

    // ---------------------------
    // .parejas
    // ---------------------------
    if (cmd === '.parejas') {
      const members = chat.participants.map(p => p.id._serialized).filter(isValidId);
      if (members.length < 2) return chat.sendMessage('⚠️ No hay suficientes miembros para parejas.');
      const shuffled = members.sort(() => 0.5 - Math.random());
      const pairs = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) pairs.push([shuffled[i], shuffled[i + 1]]);
        else pairs.push([shuffled[i]]);
      }
      let msgText = '💘 *Parejas del grupo* 💘\n──────────────────\n';
      pairs.forEach((pair, i) => {
        msgText += pair.length === 2
          ? `🔹 Pareja ${i + 1}: @${pair[0].split('@')[0]} 💖 @${pair[1].split('@')[0]}\n`
          : `🔹 Sola: @${pair[0].split('@')[0]}\n`;
      });
      await chat.sendMessage(msgText, { mentions: members });
      return;
    }

    // ---------------------------
    // .meme
    // ---------------------------
    if (cmd === '.meme') {
      try {
        const meme = await enqueue('meme', './workers/memeWorker.js', {});
        if (meme.error) throw new Error(meme.error);
        await chat.sendMessage({ file: `data:image/jpeg;base64,${meme.base64}`, caption: '🤣 Meme random' });
        deleteTmp(meme.tmpFile);
      } catch (err) {
        log('ERROR', 'Error en meme', { error: err.message });
        await chat.sendMessage('⚠️ Falló al obtener meme 😅');
      }
      return;
    }

  } catch (err) {
    log('ERROR', 'Error general', { error: err.message });
    try { await chat.sendMessage('⚠️ Error interno, pero sigo activo 😎'); } catch {}
  }
});

client.initialize();

// ---------------------------
// Express server
// ---------------------------
const app = express();
app.get('/', (_, res) => res.send('😎 Bot Pro corriendo'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => log('INFO', '🌐 Servidor Express activo'));
