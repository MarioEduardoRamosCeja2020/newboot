import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import os from 'os';

// ---------------------------
// Cache en memoria
// ---------------------------
const cache = {
  mesas: [],
  parejas: []
};

// Funciones de cache
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
// Manejo de sesión
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
  puppeteer: { headless: true, args: ['--no‑sandbox', '--disable‑setuid‑sandbox', '--disable‑dev-shm‑usage'] },
  session: sessionData,
});

// QR
client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
  console.log('🐐🇫🇷 Bot listo');
  client.on('authenticated', saveSession);

  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const group of groups) {
    try {
      await group.sendMessage('🐐🇫🇷 🎉 ¡Bot activo! Usa .bot para comandos.');
    } catch (err) {
      console.error('Error al enviar mensaje de inicio:', err);
    }
  }
});

// Monitor de recursos
setInterval(() => {
  const mem = process.memoryUsage();
  const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(2);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
  const load = os.loadavg()[0].toFixed(2);
  console.log(`🖥️ Mem: heapUsed ${heapUsedMB} MB, heapTotal ${heapTotalMB} MB, rss ${rssMB} MB, load ${load}`);
}, 60 * 1000);

// ---------------------------
// Comandos
// ---------------------------
client.on('message', async msg => {
  const chat = await msg.getChat();
  if (!chat) return;

  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();

  try {
    // Menú
    if (command === '.bot') {
      let menu = `🎉 *Menú de comandos*\n\n`;
      menu += `.bot - Mostrar este menú\n`;
      menu += `.todos - Etiquetar a todos\n`;
      menu += `.hidetag <mensaje> - Enviar mensaje ocultando menciones\n`;
      menu += `.notify <mensaje> - Notificar a todos\n`;
      menu += `.mesa4/.mesa6 <tema> - Crear mesa de 4 o 6\n`;
      menu += `.formarpareja - Formar pareja al azar\n`;
      menu += `.cancion <nombre> - <artista> - Descargar MP3\n`;
      await chat.sendMessage('🐐🇫🇷 ' + menu);
      return;
    }

    // Etiquetar todos
    if (command === '.todos' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
      await chat.sendMessage('🐐🇫🇷 *¡Atención!* 📣\n' + mentionText, { mentions });
      return;
    }

    // Hidetag
    if (command === '.hidetag' && chat.isGroup) {
      if (!text) {
        await chat.sendMessage('🐐🇫🇷 ⚠️ Indica el mensaje tras .hidetag');
        return;
      }
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await chat.sendMessage('🐐🇫🇷 ' + text, { mentions });
      return;
    }

    // Notify
    if (command === '.notify' && chat.isGroup) {
      if (!text) {
        await chat.sendMessage('🐐🇫🇷 ⚠️ Indica el mensaje tras .notify');
        return;
      }
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
      await chat.sendMessage('🐐🇫🇷 📣 Notificación a todos:\n' + mentionText + '\n\n' + text, { mentions });
      return;
    }

    // Crear mesas
    if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
      const maxPlayers = (command === '.mesa4') ? 4 : 6;
      await setMesa(chat.id._serialized, [], maxPlayers, text || '[sin tema]');
      await chat.sendMessage('🐐🇫🇷 🎲 Mesa para *' + maxPlayers + ' jugadores* iniciada.\nTema: _' + (text || '[sin tema]') + '_\nEscribe "yo" para inscribirte.');
      return;
    }

    // Inscribirse a mesa
    if (raw.toLowerCase() === 'yo' && chat.isGroup) {
      const mesa = await getMesa(chat.id._serialized);
      if (!mesa) return;
      const userId = msg.author || msg.from;
      if (!isValidUserId(userId)) return;

      if (!mesa.jugadores.includes(userId)) {
        mesa.jugadores.push(userId);
        await setMesa(chat.id._serialized, mesa.jugadores, mesa.max, mesa.tema);
        await chat.sendMessage('🐐🇫🇷 @' + userId.split('@')[0] + ' se inscribió (' + mesa.jugadores.length + '/' + mesa.max + ')', { mentions: [userId] });
      } else {
        await chat.sendMessage('🐐🇫🇷 @' + userId.split('@')[0] + ', ya estás inscrito.', { mentions: [userId] });
      }

      if (mesa.jugadores.length === mesa.max) {
        const selected = mesa.jugadores[Math.floor(Math.random() * mesa.jugadores.length)];
        const mentionText = mesa.jugadores.map(u => `@${u.split('@')[0]}`).join(' ');
        await chat.sendMessage('🐐🇫🇷 ✅ Mesa completa:\n' + mentionText + '\nTema: _' + mesa.tema + '_\n@' + selected.split('@')[0] + ', te toca poner mesa!', { mentions: mesa.jugadores.concat([selected]) });
      }
      return;
    }

    // Formar pareja
    if (command === '.formarpareja' && chat.isGroup) {
      const participantes = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      const shuffled = participantes.sort(() => Math.random() - 0.5);
      const pareja1 = shuffled[0];
      const pareja2 = shuffled[1];
      await setPareja(chat.id._serialized, pareja1, pareja2);
      await chat.sendMessage('🐐🇫🇷 💑 Pareja formada:\n@' + pareja1.split('@')[0] + ' y @' + pareja2.split('@')[0], { mentions: [pareja1, pareja2] });
      return;
    }

    // Descargar canción (placeholder)
    if (command === '.cancion') {
      if (!text.includes('-')) {
        await chat.sendMessage('🐐🇫🇷 ⚠️ Usa: .cancion <nombre> - <artista>');
        return;
      }
      const [nombre, artista] = text.split('-').map(s => s.trim());
      await chat.sendMessage('🐐🇫🇷 🎵 Descargando ' + nombre + ' de ' + artista + '...');
      return;
    }

    // Comando desconocido
    await chat.sendMessage('🐐🇫🇷 Comando no reconocido. Usa .bot para ver los comandos.');
  } catch (err) {
    console.error('💥 Error en comando:', err);
    await chat.sendMessage('🐐🇫🇷 ⚠️ Ocurrió un error, inténtalo de nuevo.');
  }
});

client.initialize();

// ---------------------------
// Manejo de errores globales
// ---------------------------
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection en promesa:', promise, 'razón:', reason);
});

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Ruta de salud
app.get('/', (req, res) => {
  res.send('🐐🇫🇷 Bot activo y listo');
});

// Iniciar servidor HTTP
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Servidor de salud escuchando en puerto ${PORT}`);
});
