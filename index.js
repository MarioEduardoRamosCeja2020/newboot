// index.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import os from 'os';
import express from 'express';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Configurar ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

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
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] },
  session: sessionData,
});

// QR
client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
  console.log('😎🐐🇫🇷 Bot listo y conectado 😎🐐🇫🇷');
  client.on('authenticated', saveSession);

  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const group of groups) {
    try {
      await group.sendMessage('😎🐐🇫🇷 🎉 ¡Bot activo! Usa *.bot* para ver los comandos disponibles 😎🐐🇫🇷');
    } catch (err) {
      console.error('💥 Error al enviar mensaje de inicio:', err);
    }
  }
});

// ---------------------------
// Monitor de recursos
// ---------------------------
setInterval(() => {
  const mem = process.memoryUsage();
  const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
  console.log(`😎🐐🇫🇷 🖥️ Memoria usada: ${heapUsedMB} MB | RSS: ${rssMB} MB 😎🐐🇫🇷`);
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
    // Menú principal
    if (command === '.bot') {
      const menu = `
😎🐐🇫🇷
🎉 *MENÚ DE COMANDOS DEL BOT* 🎉

💬 *.bot* — Mostrar este menú  
👥 *.todos* — Etiquetar a todos los miembros  
🙈 *.hidetag <mensaje>* — Enviar mensaje ocultando menciones  
📣 *.notify <mensaje>* — Notificar a todos  
🎲 *.mesa4 / .mesa6 <tema>* — Crear una mesa de 4 o 6 jugadores  
❤️ *.formarpareja* — Formar una pareja aleatoria  
🎵 *.cancion <nombre> - <artista>* — Descargar canción en MP3  

🐐 *¡El bot más chivo está activo!* 🐐
😎🐐🇫🇷
`;
      await chat.sendMessage(menu);
      return;
    }

    // Etiquetar todos
    if (command === '.todos' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
      await chat.sendMessage(`😎🐐🇫🇷 📣 *¡Atención equipo!* 📣\n${mentionText}\n😎🐐🇫🇷`, { mentions });
      return;
    }

    // Hidetag
    if (command === '.hidetag' && chat.isGroup) {
      if (!text) {
        await chat.sendMessage('😎🐐🇫🇷 ⚠️ Debes escribir un mensaje tras *.hidetag* 😎🐐🇫🇷');
        return;
      }
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      await chat.sendMessage(`😎🐐🇫🇷 ${text} 😎🐐🇫🇷`, { mentions });
      return;
    }

    // Notify
    if (command === '.notify' && chat.isGroup) {
      if (!text) {
        await chat.sendMessage('😎🐐🇫🇷 ⚠️ Escribe un mensaje después de *.notify* 😎🐐🇫🇷');
        return;
      }
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
      await chat.sendMessage(`😎🐐🇫🇷 📢 *Notificación para todos:* 📢\n\n${text}\n\n${mentionText}\n😎🐐🇫🇷`, { mentions });
      return;
    }

    // Crear mesa
    if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
      const maxPlayers = command === '.mesa4' ? 4 : 6;
      await setMesa(chat.id._serialized, [], maxPlayers, text || '[Sin tema]');
      await chat.sendMessage(`😎🐐🇫🇷 🎲 Se ha creado una *mesa para ${maxPlayers} jugadores*\n🧩 Tema: _${text || '[Sin tema]'}_\n✋ Escribe *yo* para unirte 😎🐐🇫🇷`);
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
        await chat.sendMessage(`😎🐐🇫🇷 🙋‍♂️ @${userId.split('@')[0]} se ha unido a la mesa (${mesa.jugadores.length}/${mesa.max}) 😎🐐🇫🇷`, { mentions: [userId] });
      } else {
        await chat.sendMessage(`😎🐐🇫🇷 ⚠️ @${userId.split('@')[0]}, ya estás inscrito 😎🐐🇫🇷`, { mentions: [userId] });
      }

      if (mesa.jugadores.length === mesa.max) {
        const selected = mesa.jugadores[Math.floor(Math.random() * mesa.jugadores.length)];
        const mentionText = mesa.jugadores.map(u => `@${u.split('@')[0]}`).join(' ');
        await chat.sendMessage(`😎🐐🇫🇷 ✅ *Mesa completa* ✅\n${mentionText}\n🧩 Tema: _${mesa.tema}_\n🎯 @${selected.split('@')[0]}, ¡te toca poner mesa! 😎🐐🇫🇷`, { mentions: mesa.jugadores.concat([selected]) });
      }
      return;
    }

    // Formar pareja
    if (command === '.formarpareja' && chat.isGroup) {
      const participantes = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (participantes.length < 2) {
        await chat.sendMessage('😎🐐🇫🇷 ⚠️ No hay suficientes participantes para formar pareja 😎🐐🇫🇷');
        return;
      }
      const shuffled = participantes.sort(() => Math.random() - 0.5);
      const pareja1 = shuffled[0];
      const pareja2 = shuffled[1];
      await setPareja(chat.id._serialized, pareja1, pareja2);
      await chat.sendMessage(`😎🐐🇫🇷 💞 *Pareja formada:* 💞\n@${pareja1.split('@')[0]} ❤️ @${pareja2.split('@')[0]} 😎🐐🇫🇷`, { mentions: [pareja1, pareja2] });
      return;
    }

    // Descargar canción
    if (command === '.cancion') {
      if (!text.includes('-')) {
        await chat.sendMessage('😎🐐🇫🇷 ⚠️ Usa: *.cancion <nombre> - <artista>* 😎🐐🇫🇷');
        return;
      }

      const [nombre, artista] = text.split('-').map(s => s.trim());
      const searchQuery = `${nombre} ${artista}`;
      await chat.sendMessage(`😎🐐🇫🇷 🎵 Buscando y descargando: *${nombre} - ${artista}* 😎🐐🇫🇷`);

      try {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        const html = await fetch(url).then(res => res.text());
        const videoId = html.match(/"videoId":"(.*?)"/)?.[1];
        if (!videoId) throw new Error('No se encontró video');

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const outputPath = `./temp_${Date.now()}.mp3`;

        await new Promise((resolve, reject) => {
          ffmpeg(ytdl(videoUrl, { filter: 'audioonly' }))
            .audioBitrate(128)
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
        });

        const media = MessageMedia.fromFilePath(outputPath);
        await chat.sendMessage(media, { caption: `😎🐐🇫🇷 🎶 *${nombre} - ${artista}* 😎🐐🇫🇷` });
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error('💥 Error al descargar canción:', err);
        await chat.sendMessage('😎🐐🇫🇷 ⚠️ No pude descargar la canción, intenta con otro nombre 😎🐐🇫🇷');
      }
      return;
    }

    // Comando desconocido
    await chat.sendMessage('😎🐐🇫🇷 🤔 Comando no reconocido. Usa *.bot* para ver la lista completa 😎🐐🇫🇷');
  } catch (err) {
    console.error('💥 Error en comando:', err);
    await chat.sendMessage('😎🐐🇫🇷 ⚠️ Ocurrió un error, inténtalo de nuevo 😎🐐🇫🇷');
  }
});

client.initialize();

// ---------------------------
// Servidor Express
// ---------------------------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('😎🐐🇫🇷 Bot activo y en línea 😎🐐🇫🇷'));
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Servidor corriendo en puerto ${PORT}`));
