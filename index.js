// index.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';

// ---------------------------
// Config
// ---------------------------
const SESSION_FILE = './session_data/session.json';
const MAX_STICKER_WORKERS = 4;
const MAX_OTHER_WORKERS = 2;
const TMP_DIR = './tmp';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ---------------------------
// Cache en memoria
// ---------------------------
const cache = { mesas: [], parejas: [] };
const getMesa = chatId => cache.mesas.find(m => m.chat_id === chatId);
const setMesa = (chatId, jugadores, max, tema) => {
  const existing = cache.mesas.find(m => m.chat_id === chatId);
  if (!existing) cache.mesas.push({ chat_id: chatId, jugadores, max, tema });
  else Object.assign(existing, { jugadores, max, tema });
};
const deleteMesa = chatId => cache.mesas = cache.mesas.filter(m => m.chat_id !== chatId);
const setPareja = (chatId, user1, user2) => {
  const existing = cache.parejas.find(p => p.chat_id === chatId);
  if (!existing) cache.parejas.push({ chat_id: chatId, user1, user2 });
  else Object.assign(existing, { user1, user2 });
};
const isValidUserId = id => typeof id === 'string' && id.includes('@');

// ---------------------------
// Sesión persistente
// ---------------------------
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
  puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] },
  session: sessionData
});

// ---------------------------
// QR & Ready
// ---------------------------
client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', async () => {
  console.log('😎🐐 Bot Turbo Pro listo');
  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const group of groups) {
    try { await group.sendMessage('😎🐐 Bot activo y listo'); }
    catch (err) { console.error('Error mensaje inicio:', err.message); }
  }
});

// ---------------------------
// Worker Queue genérica
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

// ---------------------------
// Función borrar archivos tmp
// ---------------------------
const deleteTmpFile = filePath => {
  if (!filePath) return;
  fs.unlink(filePath, err => { if (err) console.error('⚠️ Error borrando tmp:', err); });
};

// ---------------------------
// Comandos y mensajes
// ---------------------------
client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();
  const chat = await msg.getChat().catch(() => null);
  if (!chat) return;

  try {
    // Auto-sticker si es imagen
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media.mimetype.startsWith('image/')) {
          enqueue('sticker', './workers/stickerWorker.js', { media })
            .then(res => chat.sendMessage(new MessageMedia('image/webp', res.webp), { sendMediaAsSticker: true }))
            .catch(e => console.error('⚠️ Auto-sticker falló:', e));
        }
      } catch (err) {
        console.error('💥 Error media:', err);
        await msg.reply('⚠️ No se pudo procesar la imagen.');
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
👥 *.todos* — Etiquetar a todos
🙈 *.hidetag <msg>* — Mensaje oculto
📣 *.notify <msg>* — Notificación
🎲 *.mesa4 / .mesa6 <tema>* — Crear mesa
❤️ *.formarpareja* — Pareja aleatoria
🎵 *.musica <nombre>* — Descargar canción
🖼️ *.imagenes <desc>* — Generar imagen
🤣 *.memes* — Meme random
🖼️ *.sticker* — Sticker gigante
`);
      return;
    }

    // .todos
    if (command === '.todos' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (!mentions.length) return await chat.sendMessage('⚠️ No hay participantes válidos');
      const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
      await chat.sendMessage(`📣 INVOCACIÓN:\n${mentionLines}`, { mentions });
      return;
    }

    // .hidetag
    if (command === '.hidetag' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await chat.sendMessage(text || 'Mensaje oculto', { mentions });
      return;
    }

    // .mesa4 / .mesa6
    if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
      const maxPlayers = command === '.mesa4' ? 4 : 6;
      setMesa(chat.id._serialized, [], maxPlayers, text || '[Sin tema]');
      await chat.sendMessage(`🎲 Mesa creada para ${maxPlayers} jugadores\n🧩 Tema: _${text || '[Sin tema]'}_\n✋ Escribe *yo* para unirte`);
      return;
    }

    // Unirse a mesa
    if (raw.toLowerCase() === 'yo' && chat.isGroup) {
      const mesa = getMesa(chat.id._serialized);
      if (!mesa) return;
      const userId = msg.author || msg.from;
      if (!mesa.jugadores.includes(userId)) {
        mesa.jugadores.push(userId);
        setMesa(chat.id._serialized, mesa.jugadores, mesa.max, mesa.tema);
        await chat.sendMessage(`🙋‍♂️ @${userId.split('@')[0]} se unió (${mesa.jugadores.length}/${mesa.max})`, { mentions: [userId] });
      }
      if (mesa.jugadores.length === mesa.max) {
        const selected = mesa.jugadores[Math.floor(Math.random() * mesa.jugadores.length)];
        await chat.sendMessage(`✅ Mesa completa\n${mesa.jugadores.map(u => `@${u.split('@')[0]}`).join(' ')}\n🧩 Tema: _${mesa.tema}_\n🎯 @${selected.split('@')[0]} pone mesa.`, { mentions: mesa.jugadores });
      }
      return;
    }

    // .formarpareja
    if (command === '.formarpareja' && chat.isGroup) {
      const participantes = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (participantes.length < 2) return await chat.sendMessage('⚠️ No hay suficientes participantes.');
      const shuffled = participantes.sort(() => Math.random() - 0.5);
      const [a, b] = shuffled;
      setPareja(chat.id._serialized, a, b);
      const frases = [
        '💞 ¡Juntos por siempre!', '❤️ Amor eterno', '💌 Unidos hasta la próxima',
        '🌟 ¡La química es real!', '💕 Mesada de amor y risas', '💘 Pareja sellada con chocolate',
        '✨ Que la fuerza del amor los acompañe'
      ];
      const frase = frases[Math.floor(Math.random() * frases.length)];
      await chat.sendMessage(`💞 Pareja: @${a.split('@')[0]} ❤️ @${b.split('@')[0]}\n${frase}`, { mentions: [a,b] });
      return;
    }

    // .imagenes
    if (command === '.imagenes') {
      if (!text) return await chat.sendMessage('⚠️ Escribe la descripción de la imagen.');
      enqueue('image', './workers/imageWorker.js', { prompt: text })
        .then(async res => {
          if (res.base64) await chat.sendMessage(new MessageMedia('image/jpeg', res.base64));
          if (res.tmpFile) deleteTmpFile(res.tmpFile);
        })
        .catch(e => chat.sendMessage(`⚠️ Error generando imagen: ${e.message}`));
      return;
    }

    // .memes
    if (command === '.memes') {
      enqueue('meme', './workers/memeWorker.js', {})
        .then(async res => {
          if (res.base64) await chat.sendMessage(new MessageMedia('image/jpeg', res.base64));
          if (res.tmpFile) deleteTmpFile(res.tmpFile);
        })
        .catch(e => chat.sendMessage(`⚠️ Error generando meme: ${e.message}`));
      return;
    }

    // .musica
    if (command === '.musica') {
      if (!text) return await chat.sendMessage('⚠️ Escribe el nombre de la canción.');
      enqueue('music', './workers/musicWorker.js', { query: text })
        .then(async res => {
          if (res.file) {
            const media = MessageMedia.fromFilePath(res.file);
            await chat.sendMessage(media, { caption: res.title });
            deleteTmpFile(res.file);
          }
        })
        .catch(e => chat.sendMessage(`⚠️ Error descargando música: ${e.message}`));
      return;
    }

  } catch (err) {
    console.error('💥 Error general:', err);
    await chat.sendMessage('⚠️ Error interno, inténtalo de nuevo.');
  }
});

// ---------------------------
// Inicializar
// ---------------------------
client.initialize();

// ---------------------------
// Express server
// ---------------------------
const app = express();
app.get('/', (_, res) => res.send('😎 Bot Turbo Pro corriendo'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('🌐 Servidor Express activo'));
