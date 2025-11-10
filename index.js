// ===========================
// ⚡ BOT DE WHATSAPP ULTRARRÁPIDO
// ===========================
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import os from 'os';
import { Worker } from 'worker_threads';

// ---------------------------
// Cache en memoria
// ---------------------------
const cache = {
  mesas: [],
  parejas: []
};

async function getMesa(chatId) {
  return cache.mesas.find(m => m.chat_id === chatId);
}
async function setMesa(chatId, jugadores, max, tema) {
  const existing = cache.mesas.find(m => m.chat_id === chatId);
  if (!existing) cache.mesas.push({ chat_id: chatId, jugadores, max, tema });
  else Object.assign(existing, { jugadores, max, tema });
}
async function deleteMesa(chatId) {
  cache.mesas = cache.mesas.filter(m => m.chat_id !== chatId);
}
async function setPareja(chatId, user1, user2) {
  const existing = cache.parejas.find(p => p.chat_id === chatId);
  if (!existing) cache.parejas.push({ chat_id, user1, user2 });
  else Object.assign(existing, { user1, user2 });
}
function isValidUserId(id) {
  return typeof id === 'string' && id.includes('@');
}

// ---------------------------
// Sesión persistente
// ---------------------------
const SESSION_FILE_PATH = './session_data/session.json';
function saveSession(sessionData) {
  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessionData, null, 2));
}
function loadSession() {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    const data = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
    if (!data) return null;
    return JSON.parse(data);
  }
  return null;
}

const sessionData = loadSession();

// ---------------------------
// Cliente de WhatsApp
// ---------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot', dataPath: './session_data' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--no-zygote',
      '--single-process'
    ]
  },
  session: sessionData
});

// ---------------------------
// Eventos base
// ---------------------------
client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
  console.log('😎🐐🇫🇷 Bot rápido listo y conectado 😎🐐🇫🇷');
});

// ---------------------------
// Comandos
// ---------------------------
client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();

  // Evita obtener chat si no se necesita
  if (!raw.startsWith('.') && raw.toLowerCase() !== 'yo') return;

  const chat = await msg.getChat().catch(() => null);
  if (!chat) return;

  try {
    // ---------------------------
    // Menú principal
    // ---------------------------
    if (command === '.bot') {
      await chat.sendMessage(`
😎🐐🇫🇷
🎉 *MENÚ DEL BOT* 🎉
💬 *.bot* — Mostrar este menú
👥 *.todos* — Etiquetar a todos
🙈 *.hidetag <mensaje>*
📣 *.notify <mensaje>*
🎲 *.mesa4 / .mesa6 <tema>*
❤️ *.formarpareja*
🎵 *.musica <nombre>*
🖼️ *.sticker* (envía imagen)

🐐 *Bot Desterra2 Turbo* 🐐
😎🐐🇫🇷`);
      return;
    }

    // ---------------------------
    // Comando: .todos
    // ---------------------------
    if (command === '.todos' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await chat.sendMessage(`📣 *Atención equipo:* ${mentions.map(m => `@${m.split('@')[0]}`).join(' ')}`, { mentions });
      return;
    }

    // ---------------------------
    // Comando: .hidetag
    // ---------------------------
    if (command === '.hidetag' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await chat.sendMessage(text || 'Mensaje oculto', { mentions });
      return;
    }

    // ---------------------------
    // Comando: .mesa4 / .mesa6
    // ---------------------------
    if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
      const maxPlayers = command === '.mesa4' ? 4 : 6;
      await setMesa(chat.id._serialized, [], maxPlayers, text || '[Sin tema]');
      await chat.sendMessage(`🎲 *Mesa creada para ${maxPlayers} jugadores*\n🧩 Tema: _${text || '[Sin tema]'}_\n✋ Escribe *yo* para unirte`);
      return;
    }

    // ---------------------------
    // Comando: yo (unirse a mesa)
    // ---------------------------
    if (raw.toLowerCase() === 'yo' && chat.isGroup) {
      const mesa = await getMesa(chat.id._serialized);
      if (!mesa) return;

      const userId = msg.author || msg.from;
      if (!mesa.jugadores.includes(userId)) {
        mesa.jugadores.push(userId);
        await setMesa(chat.id._serialized, mesa.jugadores, mesa.max, mesa.tema);
        await chat.sendMessage(`🙋‍♂️ @${userId.split('@')[0]} se unió (${mesa.jugadores.length}/${mesa.max})`, { mentions: [userId] });
      }

      if (mesa.jugadores.length === mesa.max) {
        const selected = mesa.jugadores[Math.floor(Math.random() * mesa.jugadores.length)];
        await chat.sendMessage(`✅ *Mesa completa*\n${mesa.jugadores.map(u => `@${u.split('@')[0]}`).join(' ')}\n🧩 Tema: _${mesa.tema}_\n🎯 @${selected.split('@')[0]} pone mesa.`, { mentions: mesa.jugadores });
      }
      return;
    }

    // ---------------------------
    // Comando: .formarpareja
    // ---------------------------
    if (command === '.formarpareja' && chat.isGroup) {
      const participantes = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (participantes.length < 2) {
        await chat.sendMessage('⚠️ No hay suficientes participantes.');
        return;
      }
      const shuffled = participantes.sort(() => Math.random() - 0.5);
      const [a, b] = shuffled;
      await setPareja(chat.id._serialized, a, b);
      await chat.sendMessage(`💞 Pareja formada: @${a.split('@')[0]} ❤️ @${b.split('@')[0]}`, { mentions: [a, b] });
      return;
    }

    // ---------------------------
// Comando: .memes
// ---------------------------
if (command === '.memes') {
  await chat.sendMessage('🤣 Buscando un meme...');
  const worker = new Worker('./workers/memeWorker.js');

  worker.on('message', async (result) => {
    if (result.error) {
      await chat.sendMessage('⚠️ Error al obtener meme.');
    } else {
      const media = new MessageMedia('image/png', result.base64);
      await chat.sendMessage(media);
    }
  });

  return;
}

// ---------------------------
// Comando: .imagenes
// ---------------------------
if (command === '.imagenes') {
  if (!text) {
    await chat.sendMessage('⚠️ Usa: *.imagenes <descripción>*');
    return;
  }

  await chat.sendMessage(`🖼️ Generando imagen: *${text}* ...`);

  const worker = new Worker('./workers/imageWorker.js', {
    workerData: { prompt: text }
  });

  worker.on('message', async (result) => {
    if (result.error) {
      await chat.sendMessage('⚠️ Error al generar la imagen.');
    } else {
      const media = new MessageMedia('image/png', result.base64);
      await chat.sendMessage(media);
    }
  });

  return;
}


    // ---------------------------
    // Comando: .sticker (procesado en worker)
    // ---------------------------
    if (command === '.sticker' && msg.hasMedia) {
      const worker = new Worker('./workers/stickerWorker.js', {
        workerData: { mediaData: await msg.downloadMedia(), text }
      });
      worker.on('message', async (result) => {
        if (result.error) {
          await chat.sendMessage('⚠️ Error al crear sticker.');
        } else {
          const sticker = new MessageMedia('image/webp', result.webp);
          await msg.reply(sticker, undefined, { sendMediaAsSticker: true });
        }
      });
      return;
    }

    // ---------------------------
    // Comando: .musica (procesado en worker)
    // ---------------------------
    if (command === '.musica') {
      if (!text) {
        await chat.sendMessage('⚠️ Usa: *.musica <nombre>*');
        return;
      }

      await chat.sendMessage(`🎵 Buscando *${text}*...`);

      const worker = new Worker('./workers/musicWorker.js', {
        workerData: { query: text }
      });

      worker.on('message', async (result) => {
        if (result.error) {
          await chat.sendMessage('⚠️ Error al descargar canción.');
        } else {
          await chat.sendMessage(`🎶 ${result.title}`, {
            media: fs.createReadStream(result.file)
          });
          fs.unlink(result.file, () => {});
        }
      });

      return;
    }

    // Comando desconocido
    await chat.sendMessage('🤔 Comando no reconocido. Usa *.bot* para ver opciones.');
  } catch (err) {
    console.error('💥 Error general:', err);
    await chat.sendMessage('⚠️ Error interno, inténtalo de nuevo.');
  }
});

client.initialize();

// ---------------------------
// Servidor Express
// ---------------------------
const app = express();
app.get('/', (_, res) => res.send('😎🐐🇫🇷 Bot Desterra2 Turbo corriendo 😎🐐🇫🇷'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('🌐 Servidor Express activo.'));
