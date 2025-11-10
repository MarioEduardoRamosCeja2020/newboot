import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';
import lowdb from 'lowdb';   // Importación por defecto
const { Low, JSONFile } = lowdb;  // Desestructurando para obtener Low y JSONFile
import os from 'os';

const SESSION_FILE_PATH = './session_data/session.json';
const PORT = process.env.PORT || 10000;

// Crear la base de datos en formato JSON para almacenar las mesas y parejas (si se requiere)
const adapter = new JSONFile('db.json');
const db = new Low(adapter);
await db.read();
db.data ||= { mesas: [], parejas: [] };
await db.write();

// Inicializar la base de datos y las funciones
async function getMesa(chatId) {
  return db.data.mesas.find(m => m.chat_id === chatId);
}

async function setMesa(chatId, jugadores, max, tema) {
  const existing = db.data.mesas.find(m => m.chat_id === chatId);
  if (!existing) {
    db.data.mesas.push({ chat_id: chatId, jugadores, max, tema });
  } else {
    Object.assign(existing, { jugadores, max, tema });
  }
  await db.write();
}

async function deleteMesa(chatId) {
  db.data.mesas = db.data.mesas.filter(m => m.chat_id !== chatId);
  await db.write();
}

async function setPareja(chatId, user1, user2) {
  const existing = db.data.parejas.find(p => p.chat_id === chatId);
  if (!existing) {
    db.data.parejas.push({ chat_id: chatId, user1, user2 });
  } else {
    Object.assign(existing, { user1, user2 });
  }
  await db.write();
}

function isValidUserId(id) {
  return typeof id === 'string' && id.includes('@');
}

// Funciones para manejar la sesión
function saveSession(sessionData) {
  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessionData, null, 2));
  console.log('Sesión guardada correctamente.');
}

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      const sessionData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
      if (!sessionData) return null;
      return JSON.parse(sessionData);
    }
    return null;
  } catch (error) {
    console.error('Error al cargar la sesión:', error);
    return null;
  }
}

const sessionData = loadSession();

// Configurar cliente WhatsApp con LocalAuth
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot', dataPath: './session_data' }),
  puppeteer: { headless: true, args: ['--no‑sandbox', '--disable‑setuid‑sandbox', '--disable‑dev‑shm‑usage'] },
  session: sessionData,
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('Escanea este QR para iniciar sesión');
});

client.on('ready', async () => {
  console.log(`Bot listo y funcionando en puerto ${PORT}`);

  // Si la sesión es exitosa, guardamos la sesión
  client.on('authenticated', session => {
    saveSession(session);
  });

  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const group of groups) {
    try {
      await group.sendMessage('🎉 ¡Bot activo y listo! Usa .bot para ver los comandos.');
    } catch (err) {
      console.warn('No se pudo notificar al grupo', group.id._serialized, err);
    }
  }
});

// Monitor de recursos (opcional para mejorar el rendimiento)
setInterval(() => {
  const mem = process.memoryUsage();
  const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(2);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
  const load = os.loadavg()[0].toFixed(2);
  const start = process.hrtime();
  setImmediate(() => {
    const delta = process.hrtime(start);
    const lagMs = (delta[0] * 1e3 + delta[1] / 1e6).toFixed(2);
    console.log(`Memoria: heapUsed=${heapUsedMB}MB heapTotal=${heapTotalMB}MB rss=${rssMB}MB | CPU load: ${load} | Event-loop lag: ${lagMs}ms`);
    if (lagMs > 200 || parseFloat(heapUsedMB) > 300) {
      console.warn('⚠️ Umbral de carga alcanzado — reiniciando cliente.');
      client.destroy();
      client.initialize();
    }
  });
}, 60 * 1000);

// Comandos del bot
client.on('message', async msg => {
  const chat = await msg.getChat();
  if (!chat) return;

  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();

  try {
    if (command === '.bot') {
      let menu = `🎉 *Menú de comandos*\n\n`;
      menu += `.bot - Mostrar este menú\n`;
      menu += `.todos - Etiquetar a todos\n`;
      menu += `.hidetag <mensaje> - Enviar mensaje ocultando menciones\n`;
      menu += `.notify <mensaje> - Notificar a todos\n`;
      menu += `.mesa4/.mesa6 <mensaje> - Crear mesa de 4 o 6\n`;
      menu += `.formarpareja - Formar pareja al azar y felicitar\n`;
      menu += `.sticker <imagen/video> - Crear sticker\n`;
      await chat.sendMessage(menu);
      return;
    }

    if (command === '.todos' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
      const messageText = `*¡Atención Chivas!* 📣\n_Etiquetando a todos los miembros:_\n\n${mentionLines}\n\n¡Vamos con todo! 🔥`;
      await chat.sendMessage(messageText, { mentions });
      return;
    }

    if (command === '.hidetag' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (!text) {
        await chat.sendMessage('⚠️ Debes indicar el mensaje después del comando .hidetag.');
        return;
      }
      await chat.sendMessage(text, { mentions });
      return;
    }

    if (command === '.notify' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (!text) {
        await chat.sendMessage('⚠️ Debes indicar el mensaje después del comando .notify.');
        return;
      }
      const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
      const messageText = `📣 Notificación a todos:\n\n${mentionLines}\n\n${text}`;
      await chat.sendMessage(messageText, { mentions });
      return;
    }

    if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
      const maxPlayers = (command === '.mesa4') ? 4 : 6;
      await setMesa(chat.id._serialized, [], maxPlayers, text || '[sin tema]');
      await chat.sendMessage(`🎲 Mesa para *${maxPlayers} jugadores* iniciada.\nTema: _${text || '[sin tema]'}_\nEscribe *yo* para inscribirte.`);
      return;
    }

    if (raw.toLowerCase() === 'yo' && chat.isGroup) {
      const mesa = await getMesa(chat.id._serialized);
      if (!mesa) return;
      const userId = msg.author || msg.from;
      if (!isValidUserId(userId)) return;

      if (mesa.jugadores.includes(userId)) {
        await chat.sendMessage(`@${userId.split('@')[0]}, ya estás inscrito.`, { mentions: [userId] });
        return;
      }

      mesa.jugadores.push(userId);
      await setMesa(chat.id._serialized, mesa.jugadores, mesa.max, mesa.tema);
      await chat.sendMessage(`@${userId.split('@')[0]} se ha inscrito (${mesa.jugadores.length}/${mesa.max})`, { mentions: [userId] });

      if (mesa.jugadores.length === mesa.max) {
        const arr = mesa.jugadores;
        const mentionText = arr.map(u => `@${u.split('@')[0]}`).join(' ');
        await chat.sendMessage(`✅ Mesa de ${mesa.max} jugadores completa:\n${mentionText}\nTema: _${mesa.tema}_\n¡Vamos con todo!`, { mentions: arr });
      }
      return;
    }

    if (command === '.formarpareja' && chat.isGroup) {
      const participantes = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      const shuffled = participantes.sort(() => Math.random() - 0.5); // Aleatorio
      const pareja1 = shuffled[0];
      const pareja2 = shuffled[1];
      await setPareja(chat.id._serialized, pareja1, pareja2);
      await chat.sendMessage(`💑 Pareja formada:\n@${pareja1.split('@')[0]} y @${pareja2.split('@')[0]}`);
      return;
    }

    // Si no reconoce el comando
    await chat.sendMessage('Comando no reconocido. Usa .bot para ver los comandos.');
  } catch (err) {
    console.error('Error procesando mensaje:', err);
    await chat.sendMessage('⚠️ Ocurrió un error, inténtalo de nuevo.');
  }
});

client.initialize();
