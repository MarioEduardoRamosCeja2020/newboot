import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import { Worker } from 'worker_threads';

// ---------------------------
// Config
// ---------------------------
const MAX_STICKER_WORKERS = 4;
const MAX_OTHER_WORKERS = 2;
const TMP_DIR = './tmp';
const LOG_FILE = './logs/bot.log';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');

// ---------------------------
// Logging Inteligente
// ---------------------------
function logEvent(type, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${type}] ${message} ${Object.keys(data).length ? JSON.stringify(data) : ''}\n`;
  fs.appendFile(LOG_FILE, logLine, err => { if (err) console.error('⚠️ Error guardando log:', err); });
  console.log(`${type === 'ERROR' ? '💥' : '🧠'} ${message}`);
}

// ---------------------------
// Cache y sesión
// ---------------------------
const cache = { mesas: [], parejas: [] };
const getMesa = chatId => cache.mesas.find(m => m.chat_id === chatId);
const setMesa = (chatId, jugadores, max, tema) => {
  const existing = cache.mesas.find(m => m.chat_id === chatId);
  if (!existing) cache.mesas.push({ chat_id: chatId, jugadores, max, tema });
  else Object.assign(existing, { jugadores, max, tema });
};
const setPareja = (chatId, user1, user2) => {
  const existing = cache.parejas.find(p => p.chat_id === chatId);
  if (!existing) cache.parejas.push({ chat_id: chatId, user1, user2 });
  else Object.assign(existing, { user1, user2 });
};
const isValidUserId = id => typeof id === 'string' && id.includes('@');

// ---------------------------
// Sesión persistente
// ---------------------------
const SESSION_FILE = './session_data/session.json';
const loadSession = () => {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8')); }
  catch { return null; }
};
const sessionData = loadSession();

// ---------------------------
// Cliente WhatsApp
// ---------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot', dataPath: './session_data' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  session: sessionData
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', async () => {
  logEvent('INFO', '😎🐐 Bot Turbo Pro listo');
  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const group of groups) {
    try {
      await group.sendMessage('😎🐐 Bot activo y listo');
      logEvent('START', 'Mensaje de inicio enviado a grupo', { group: group.name });
    } catch (err) {
      logEvent('ERROR', 'Error al enviar mensaje de inicio', { error: err.message });
    }
  }
});

// ---------------------------
// Worker Queue
// ---------------------------
const queues = { sticker: [], image: [], meme: [], music: [] };
const activeWorkers = { sticker: 0, image: 0, meme: 0, music: 0 };

function enqueue(type, workerFile, workerData) {
  return new Promise((resolve, reject) => {
    queues[type].push({ workerFile, workerData, resolve, reject });
    processQueue(type);
  });
}

function processQueue(type) {
  const maxWorkers = type === 'sticker' ? MAX_STICKER_WORKERS : MAX_OTHER_WORKERS;
  if (!queues[type].length || activeWorkers[type] >= maxWorkers) return;
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

const deleteTmpFile = filePath => {
  if (!filePath) return;
  fs.unlink(filePath, err => { if (err) logEvent('WARN', 'Error borrando tmp', { filePath }); });
};

// ---------------------------
// Anti-Spam & Cooldowns
// ---------------------------
const groupCooldowns = {};
const COOLDOWNS = { todos: 10 * 60e3, hidetag: 5 * 60e3, notify: 5 * 60e3 };

async function sendSafeMessageRandom(chat, text, mentions, batchSize = 5, minDelay = 1500, maxDelay = 3500) {
  for (let i = 0; i < mentions.length; i += batchSize) {
    const batch = mentions.slice(i, i + batchSize);
    await chat.sendMessage(`${text}\n${batch.map(m => `@${m.split('@')[0]}`).join(' ')}`, { mentions: batch });
    const delay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
    await new Promise(res => setTimeout(res, delay));
  }
}

// ---------------------------
// Mensajes
// ---------------------------
client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();
  const chat = await msg.getChat().catch(() => null);
  if (!chat) return;
  const senderId = msg.author || msg.from;
  const now = Date.now();
  const isAdmin = chat.isGroup ? chat.participants.find(p => p.id._serialized === senderId)?.isAdmin : true;

  try {
    logEvent('CMD', `${command} ejecutado`, { from: senderId, group: chat.name });

    // ---------------------------
    // Auto-sticker solo admins y solo imágenes
    // ---------------------------
    if (msg.hasMedia) {
      if (chat.isGroup && !isAdmin) return; // No admin -> no sticker
      const media = await msg.downloadMedia();
      if (media.mimetype.startsWith('image/') && !media.filename?.endsWith('.webp')) {
        enqueue('sticker', './workers/stickerWorker.js', { media })
          .then(({ webp, tmpFile }) => {
            chat.sendMessage(new MessageMedia('image/webp', webp), { sendMediaAsSticker: true });
            deleteTmpFile(tmpFile);
          })
          .catch(err => logEvent('ERROR', 'Sticker falló', { error: err.message }));
      }
      return;
    }

    // ---------------------------
    // Menú
    // ---------------------------
    if (command === '.bot') {
      await chat.sendMessage(`
🎉 MENÚ DEL BOT 🎉
💬 *.bot* — Mostrar menú
👥 *.todos* — Etiquetar a todos (solo admin, cada 10 min)
🙈 *.hidetag <msg>* — Mensaje oculto (solo admin, 5 min)
📣 *.notify <msg>* — Aviso general (solo admin, 5 min)
🎲 *.mesa4 / .mesa6 <tema>* — Crear mesa
❤️ *.formarpareja* — Pareja aleatoria
🎵 *.musica <nombre>* — Descargar canción
🖼️ *.imagenes <desc>* — Generar imagen
🤣 *.memes* — Meme random
`);
      return;
    }

    // ---------------------------
    // Comando .todos
    // ---------------------------
    if (command === '.todos' && chat.isGroup) {
      if (!isAdmin) return chat.sendMessage('⚠️ Solo administradores pueden usar este comando.');
      if (now - (groupCooldowns[chat.id._serialized]?.todos || 0) < COOLDOWNS.todos)
        return chat.sendMessage('⏳ Espera 10 minutos antes de usar .todos otra vez.');
      groupCooldowns[chat.id._serialized] = { ...groupCooldowns[chat.id._serialized], todos: now };
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await sendSafeMessageRandom(chat, '📣 INVOCACIÓN:', mentions);
      logEvent('ACTION', 'Comando .todos ejecutado', { group: chat.name });
      return;
    }

    // ---------------------------
    // Comando .hidetag
    // ---------------------------
    if (command === '.hidetag' && chat.isGroup) {
      if (!isAdmin) return chat.sendMessage('⚠️ Solo los admins pueden usar este comando.');
      if (now - (groupCooldowns[chat.id._serialized]?.hidetag || 0) < COOLDOWNS.hidetag)
        return chat.sendMessage('⏳ Espera 5 minutos antes de usar .hidetag otra vez.');
      groupCooldowns[chat.id._serialized] = { ...groupCooldowns[chat.id._serialized], hidetag: now };
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await sendSafeMessageRandom(chat, text || 'Mensaje oculto:', mentions, 10, 1200, 3000);
      return;
    }

    // ---------------------------
    // Comando .notify
    // ---------------------------
    if (command === '.notify' && chat.isGroup) {
      if (!isAdmin) return chat.sendMessage('⚠️ Solo los admins pueden usar este comando.');
      if (now - (groupCooldowns[chat.id._serialized]?.notify || 0) < COOLDOWNS.notify)
        return chat.sendMessage('⏳ Espera 5 minutos antes de usar .notify otra vez.');
      groupCooldowns[chat.id._serialized] = { ...groupCooldowns[chat.id._serialized], notify: now };
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await sendSafeMessageRandom(chat, `📢 ${text || 'Aviso general'}`, mentions, 8, 1500, 4000);
      return;
    }

    // ---------------------------
    // Resto: mesas, pareja, memes, imagenes, musica
    // ---------------------------
    // [Aquí puedes mantener tu lógica previa]

  } catch (err) {
    logEvent('ERROR', 'Error general', { error: err.message });
    await chat.sendMessage('⚠️ Error interno, inténtalo de nuevo.');
  }
});

client.initialize();

// ---------------------------
// Express
// ---------------------------
const app = express();
app.get('/', (_, res) => res.send('😎 Bot Turbo Pro corriendo'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => logEvent('INFO', '🌐 Servidor Express activo'));
