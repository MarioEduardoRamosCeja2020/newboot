// ===========================
// ⚡ BOT DE WHATSAPP ULTRARRÁPIDO
// ===========================
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import { Worker } from 'worker_threads';

// ---------------------------
// Cache en memoria
// ---------------------------
const cache = { mesas: [], parejas: [] };

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
  if (!existing) cache.parejas.push({ chat_id: chatId, user1, user2 });
  else Object.assign(existing, { user1, user2 });
}

function isValidUserId(id) {
  return typeof id === 'string' && id.includes('@');
}

// ---------------------------
// Sesión persistente segura
// ---------------------------
const SESSION_FILE_PATH = './session_data/session.json';
function saveSession(sessionData) {
  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessionData, null, 2));
}
function loadSession() {
  if (!fs.existsSync(SESSION_FILE_PATH)) return null;
  try {
    const raw = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ Sesión corrupta o inválida, se reiniciará:', err.message);
    return null;
  }
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

  // Enviar mensaje a todos los grupos donde está el bot
  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const group of groups) {
    try {
      await group.sendMessage('😎🐐🇫🇷 El bot está activo y listo para usar 😎🐐🇫🇷');
    } catch (err) {
      console.error('⚠️ Error al enviar mensaje de inicio:', err.message);
    }
  }
});

// ---------------------------
// Comandos
// ---------------------------
client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();

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
🙈 *.hidetag <mensaje>* — Mensaje oculto
📣 *.notify <mensaje>* — Notificación
🎲 *.mesa4 / .mesa6 <tema>* — Crear mesa
❤️ *.formarpareja* — Formar pareja aleatoria
🎵 *.musica <nombre>* — Descargar canción
🖼️ *.imagenes <descripción>* — Generar imagen
🤣 *.memes* — Meme random
🖼️ *.sticker* — Sticker gigante con texto
😎🐐🇫🇷`);
      return;
    }

    // ---------------------------
    // Comando: .todos
    // ---------------------------
    if (command === '.todos' && chat.isGroup) {
      const mentions = chat.participants
        .map(p => p.id._serialized)
        .filter(isValidUserId);

      if (!mentions.length)
        return await chat.sendMessage('⚠️ No se encontraron participantes válidos.');

      const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
      await chat.sendMessage(`📣 *INVOCACIÓN:* \n${mentionLines}`, { mentions });
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
      try {
        const participantes = chat.participants
          .map(p => p.id._serialized)
          .filter(isValidUserId);

        if (participantes.length < 2)
          return await chat.sendMessage('⚠️ No hay suficientes participantes.');

        const shuffled = participantes.sort(() => Math.random() - 0.5);
        const [a, b] = shuffled;
        await setPareja(chat.id._serialized, a, b);

        const frases = [
          '💞 ¡Juntos por siempre! 🌹',
          '❤️ Amor eterno para esta parejita 💖',
          '💌 Unidos hasta la próxima aventura',
          '🌟 ¡La química es real! 💫',
          '💕 Una mesada de amor y risas para ustedes',
          '💘 Pareja sellada con risas y chocolate 🍫',
          '✨ Que la fuerza del amor los acompañe siempre 💫'
        ];
        const frase = frases[Math.floor(Math.random() * frases.length)];

        await chat.sendMessage(`💞 Pareja formada: @${a.split('@')[0]} ❤️ @${b.split('@')[0]}\n${frase}`, { mentions: [a, b] });
      } catch (err) {
        console.error('💥 Error al formar pareja:', err);
        await chat.sendMessage('⚠️ Error al formar pareja.');
      }
      return;
    }

    // ---------------------------
    // Comando desconocido
    // ---------------------------
    const comandosValidos = ['.bot', '.todos', '.hidetag', '.mesa4', '.mesa6', '.formarpareja', '.musica', '.imagenes', '.memes', '.sticker'];
    if (raw.startsWith('.') && !comandosValidos.includes(command)) {
      await chat.sendMessage(`😎🐐🇫🇷🤔 Comando "${command}" no reconocido. Usa *.bot* para ver opciones.😎🐐🇫🇷`);
      return;
    }

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
app.get('/', (_, res) => res.send('😎🐐🇫🇷 Bot Turbo corriendo 😎🐐🇫🇷'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('🌐 Servidor Express activo.'));
