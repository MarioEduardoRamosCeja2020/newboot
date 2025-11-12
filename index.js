// index.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';

// ===============================
// ⚙️ CONFIGURACIÓN BASE
// ===============================
const MAX_STICKER_WORKERS = 4;
const MAX_OTHER_WORKERS = 2;
const TMP_DIR = './tmp';
const LOG_FILE = './logs/bot.log';

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync('./logs')) fs.mkdirSync('./logs', { recursive: true });

// ===============================
// 🧾 LOGGING
// ===============================
function logEvent(type, message, data = {}) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${type}] ${message} ${Object.keys(data).length ? JSON.stringify(data) : ''}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(`${type === 'ERROR' ? '💥' : '🧠'} ${message}`);
}

// ===============================
// 💾 SESIÓN Y CACHE
// ===============================
const cache = { mesas: [], parejas: [] };
const getMesa = chatId => cache.mesas.find(m => m.chat_id === chatId);
const setMesa = (chatId, jugadores, max, tema) => {
  const mesa = cache.mesas.find(m => m.chat_id === chatId);
  if (!mesa) cache.mesas.push({ chat_id: chatId, jugadores, max, tema });
  else Object.assign(mesa, { jugadores, max, tema });
};
const setPareja = (chatId, user1, user2) => {
  const pareja = cache.parejas.find(p => p.chat_id === chatId);
  if (!pareja) cache.parejas.push({ chat_id: chatId, user1, user2 });
  else Object.assign(pareja, { user1, user2 });
};
const isValidUserId = id => typeof id === 'string' && id.includes('@');

// ===============================
// 🔐 CLIENTE WHATSAPP
// ===============================
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot', dataPath: './session_data' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', async () => {
  logEvent('INFO', '😎🐐 Bot Turbo Pro listo');
  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const g of groups) {
    try {
      await g.sendMessage('😎🐐 Bot activo y listo');
      logEvent('INFO', `Mensaje de inicio enviado a ${g.name}`);
    } catch (e) {
      logEvent('ERROR', 'Error mensaje inicio', { group: g.name, error: e.message });
    }
  }
});

// ===============================
// 🧵 WORKERS
// ===============================
const queues = { sticker: [], image: [], meme: [], music: [] };
const activeWorkers = { sticker: 0, image: 0, meme: 0, music: 0 };

function enqueue(type, file, data) {
  return new Promise((resolve, reject) => {
    queues[type].push({ file, data, resolve, reject });
    processQueue(type);
  });
}

function processQueue(type) {
  const max = type === 'sticker' ? MAX_STICKER_WORKERS : MAX_OTHER_WORKERS;
  if (!queues[type].length || activeWorkers[type] >= max) return;
  const { file, data, resolve, reject } = queues[type].shift();
  activeWorkers[type]++;
  const worker = new Worker(file, { workerData: data });
  worker.on('message', msg => resolve(msg));
  worker.on('error', err => reject(err));
  worker.on('exit', () => { activeWorkers[type]--; processQueue(type); });
}

const deleteTmpFile = f => f && fs.existsSync(f) && fs.unlink(f, () => {});

// ===============================
// ⏳ ANTI-SPAM / COOLDOWNS
// ===============================
const groupCooldowns = {};
const COOLDOWNS = { todos: 10 * 60e3, hidetag: 5 * 60e3, notify: 5 * 60e3 };

async function sendSafeMessageRandom(chat, text, mentions, batch = 10) {
  for (let i = 0; i < mentions.length; i += batch) {
    const part = mentions.slice(i, i + batch);
    await chat.sendMessage(`${text}\n${part.map(m => `@${m.split('@')[0]}`).join(' ')}`, { mentions: part });
    await new Promise(r => setTimeout(r, 2500 + Math.random() * 2000));
  }
}

// ===============================
// 📩 MANEJO DE MENSAJES
// ===============================
client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const cmd = args[0]?.toLowerCase();
  const text = args.slice(1).join(' ').trim();
  const chat = await msg.getChat().catch(() => null);
  if (!chat) return;
  const sender = msg.author || msg.from;
  const now = Date.now();

  try {
    logEvent('CMD', `${cmd} ejecutado`, { from: sender, group: chat.name });

    // 🧩 Auto-sticker (solo si no es sticker ya)
    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      if (media.mimetype.startsWith('image/') && !media.mimetype.includes('webp')) {
        enqueue('sticker', './workers/stickerWorker.js', { media })
          .then(res => chat.sendMessage(new MessageMedia('image/webp', res.webp), { sendMediaAsSticker: true }))
          .catch(e => logEvent('ERROR', 'Sticker falló', { error: e.message }));
      }
      return;
    }

    // 📜 Menú
    if (cmd === '.bot') {
      await chat.sendMessage(`
🎉 *MENÚ DEL BOT TURBO PRO* 🎉
💬 *.bot* — Mostrar menú
👥 *.todos* — Etiquetar a todos (solo admins, 10 min)
🙈 *.hidetag <msg>* — Mensaje oculto (solo admins, 5 min)
📣 *.notify <msg>* — Aviso general (solo admins, 5 min)
🎲 *.mesa4 / .mesa6 <tema>* — Crear mesa
❤️ *.formarpareja* — Pareja aleatoria
🎵 *.musica <nombre>* — Descargar canción
🖼️ *.imagenes <desc>* — Generar imagen
🤣 *.memes* — Meme random
`);
      return;
    }

    // ===============================
    // 👥 .TODOS — MENCIÓN MASIVA
    // ===============================
    if (cmd === '.todos' && chat.isGroup) {
      await chat.fetchParticipants();
      const isAdmin = chat.participants.find(p => p.id._serialized === sender)?.isAdmin;
      if (!isAdmin) return chat.sendMessage('⚠️ Solo los administradores pueden usar este comando.');

      if (now - (groupCooldowns[chat.id._serialized]?.todos || 0) < COOLDOWNS.todos)
        return chat.sendMessage('⏳ Espera 10 minutos antes de usar .todos nuevamente.');

      groupCooldowns[chat.id._serialized] = { ...groupCooldowns[chat.id._serialized], todos: now };
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await chat.sendMessage('📣 INVOCACIÓN GENERAL EN PROGRESO...');
      await sendSafeMessageRandom(chat, '📢 Llamando a todos:', mentions, 10);
      await chat.sendMessage('✅ Etiquetado completado.');
      return;
    }

    // ===============================
    // 🙈 .HIDETAG — MENSAJE OCULTO
    // ===============================
    if (cmd === '.hidetag' && chat.isGroup) {
      await chat.fetchParticipants();
      const isAdmin = chat.participants.find(p => p.id._serialized === sender)?.isAdmin;
      if (!isAdmin) return chat.sendMessage('⚠️ Solo los administradores pueden usar este comando.');
      if (now - (groupCooldowns[chat.id._serialized]?.hidetag || 0) < COOLDOWNS.hidetag)
        return chat.sendMessage('⏳ Espera 5 minutos antes de usar .hidetag nuevamente.');
      groupCooldowns[chat.id._serialized] = { ...groupCooldowns[chat.id._serialized], hidetag: now };
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await sendSafeMessageRandom(chat, text || 'Mensaje oculto:', mentions, 8);
      return;
    }

    // ===============================
    // 📣 .NOTIFY — MENSAJE MASIVO
    // ===============================
    if (cmd === '.notify' && chat.isGroup) {
      await chat.fetchParticipants();
      const isAdmin = chat.participants.find(p => p.id._serialized === sender)?.isAdmin;
      if (!isAdmin) return chat.sendMessage('⚠️ Solo los administradores pueden usar este comando.');
      if (now - (groupCooldowns[chat.id._serialized]?.notify || 0) < COOLDOWNS.notify)
        return chat.sendMessage('⏳ Espera 5 minutos antes de usar .notify nuevamente.');
      groupCooldowns[chat.id._serialized] = { ...groupCooldowns[chat.id._serialized], notify: now };
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await sendSafeMessageRandom(chat, `📢 ${text || 'Aviso general:'}`, mentions, 8);
      return;
    }

    // ===============================
    // 🎲 MESAS Y PAREJAS (sin cambios)
    // ===============================
    if ((cmd === '.mesa4' || cmd === '.mesa6') && chat.isGroup) {
      const max = cmd === '.mesa4' ? 4 : 6;
      setMesa(chat.id._serialized, [], max, text || '[Sin tema]');
      await chat.sendMessage(`🎲 Mesa creada para ${max} jugadores\n🧩 Tema: _${text || '[Sin tema]'}_\n✋ Escribe *yo* para unirte`);
      return;
    }

    if (raw.toLowerCase() === 'yo' && chat.isGroup) {
      const mesa = getMesa(chat.id._serialized);
      if (!mesa) return;
      const user = msg.author || msg.from;
      if (!mesa.jugadores.includes(user)) mesa.jugadores.push(user);
      if (mesa.jugadores.length === mesa.max) {
        const elegido = mesa.jugadores[Math.floor(Math.random() * mesa.jugadores.length)];
        await chat.sendMessage(`✅ Mesa completa:\n${mesa.jugadores.map(u => `@${u.split('@')[0]}`).join(' ')}\n🧩 Tema: _${mesa.tema}_\n🎯 @${elegido.split('@')[0]} pone mesa.`, { mentions: mesa.jugadores });
      }
      return;
    }

    if (cmd === '.formarpareja' && chat.isGroup) {
      await chat.fetchParticipants();
      const users = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (users.length < 2) return chat.sendMessage('⚠️ No hay suficientes participantes.');
      const [a, b] = users.sort(() => Math.random() - 0.5);
      const frases = ['💞 ¡Juntos por siempre!', '❤️ Amor eterno', '✨ Amor y risas'];
      await chat.sendMessage(`💞 Pareja: @${a.split('@')[0]} ❤️ @${b.split('@')[0]}\n${frases[Math.floor(Math.random() * frases.length)]}`, { mentions: [a, b] });
      return;
    }

    // ===============================
    // 🤖 OTROS COMANDOS (memes, imágenes, música)
    // ===============================
    if (cmd === '.imagenes') {
      if (!text) return chat.sendMessage('⚠️ Escribe la descripción.');
      enqueue('image', './workers/imageWorker.js', { prompt: text })
        .then(r => r.base64 && chat.sendMessage(new MessageMedia('image/jpeg', r.base64)))
        .catch(e => chat.sendMessage('⚠️ Error generando imagen: ' + e.message));
      return;
    }

    if (cmd === '.memes') {
      enqueue('meme', './workers/memeWorker.js', {})
        .then(r => r.base64 && chat.sendMessage(new MessageMedia('image/jpeg', r.base64)))
        .catch(e => chat.sendMessage('⚠️ Error generando meme: ' + e.message));
      return;
    }

    if (cmd === '.musica') {
      if (!text) return chat.sendMessage('⚠️ Escribe el nombre de la canción.');
      enqueue('music', './workers/musicWorker.js', { query: text })
        .then(async r => {
          if (r.file) {
            const media = MessageMedia.fromFilePath(r.file);
            await chat.sendMessage(media, { caption: r.title });
            deleteTmpFile(r.file);
          }
        })
        .catch(e => chat.sendMessage('⚠️ Error descargando música: ' + e.message));
      return;
    }

  } catch (err) {
    logEvent('ERROR', 'Error general', { error: err.message });
    await chat.sendMessage('⚠️ Error interno, inténtalo de nuevo.');
  }
});

// ===============================
// 🚀 INICIO
// ===============================
client.initialize();

// ===============================
// 🌐 EXPRESS
// ===============================
const app = express();
app.get('/', (_, res) => res.send('😎 Bot Turbo Pro corriendo sin errores 🚀'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => logEvent('INFO', 'Servidor Express activo'));
