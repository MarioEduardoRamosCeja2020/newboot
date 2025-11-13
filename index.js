import { Client, LocalAuth, MessageMedia } from 'baileys';
import fetch from 'node-fetch';
import { Worker } from 'worker_threads';
import fs from 'fs';
import express from 'express';
import path from 'path';
import os from 'os';
import { logEvent } from './utils'; // Importa la función de log

// ---------------------------
// Configuración
// ---------------------------
const TMP_DIR = './tmp';
const LOG_FILE = './logs/bot.log';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');
if (!fs.existsSync('./assets')) fs.mkdirSync('./assets');

// ---------------------------
// Funciones de utilidad
// ---------------------------
const isValidUserId = id => typeof id === 'string' && id.includes('@');

// ---------------------------
// Enviar mensajes seguros
// ---------------------------
async function sendSafeMessage(chat, text, mentions, batchSize = 5, minDelay = 1500, maxDelay = 3500) {
  try {
    for (let i = 0; i < mentions.length; i += batchSize) {
      const batch = mentions.slice(i, i + batchSize);
      await chat.sendMessage(`${text}\n${batch.map(m => `@${m.split('@')[0]}`).join(' ')}`, { mentions: batch });
      const delay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
      await new Promise(res => setTimeout(res, delay));
    }
  } catch (err) {
    logEvent('ERROR', 'Error al enviar mensaje seguro', { error: err.message });
  }
}

// ---------------------------
// Comando .meme
// ---------------------------
async function handleMemeCommand(chat) {
  try {
    const generatedMeme = await generateMemeWithWorker();
    await chat.sendMessage('😂 Aquí va tu meme', { media: generatedMeme });
  } catch (err) {
    logEvent('ERROR', 'Error al obtener meme', { error: err.message });
    await chat.sendMessage('Ups, no pude conseguir un meme ahora 😅');
  }
}

// ---------------------------
// Función para manejar el comando .parejas
// ---------------------------
async function handleParejasCommand(chat) {
  try {
    const participants = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
    if (participants.length < 2) {
      await chat.sendMessage('No hay suficientes participantes para formar parejas 😅');
      return;
    }
    const shuffled = participants.sort(() => Math.random() - 0.5);
    let msgParejas = '💘 *Parejas del grupo* 💘\n\n';
    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];
      msgParejas += p2 ? `@${p1.split('@')[0]} ❤️ @${p2.split('@')[0]}\n` : `@${p1.split('@')[0]} 💔 (sin pareja)\n`;
    }
    await chat.sendMessage(msgParejas, { mentions: shuffled });
  } catch (err) {
    logEvent('ERROR', 'Error al generar parejas', { error: err.message });
  }
}

// ---------------------------
// Generar meme con worker
// ---------------------------
function generateMemeWithWorker() {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./workers/memeWorker.js'); // worker.js que se encarga de obtener memes

    worker.on('message', (message) => {
      if (message.status === 'success') {
        resolve(message.media); // Resolvemos con el meme generado
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on('error', (err) => reject(err)); // Si el worker falla
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// ---------------------------
// Cliente Baileys
// ---------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot', dataPath: './session_data' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

client.on('qr', qr => {
  console.log('QR recibido: ', qr);
  // Si quieres generar el código QR en consola
  require('qrcode-terminal').generate(qr, { small: true });
});

client.on('ready', async () => {
  logEvent('INFO', 'Bot listo');
  try {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    for (const group of groups) {
      await group.sendMessage('Bot activo y listo');
    }
  } catch (err) {
    logEvent('ERROR', 'Error al enviar mensaje de inicio', { error: err.message });
  }
});

client.on('message', async msg => {
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();
  let chat;

  try {
    chat = await msg.getChat();
  } catch (err) {
    logEvent('ERROR', 'Error al obtener el chat', { error: err.message });
    return;
  }

  try {
    if (command === '.bot') {
      await chat.sendMessage(`
🎉 *MENÚ DEL BOT ULTRA RÁPIDO* 🎉

💬 *.bot* — Mostrar este menú
👥 *.todos* — Etiquetar a todos
🙈 *.hidetag <msg>* — Mensaje oculto
📣 *.notify <msg>* — Aviso general
😂 *.meme* — Meme aleatorio
❤️ *.parejas* — Formar parejas al azar`);
      return;
    }

    if (command === '.meme') {
      await handleMemeCommand(chat);
      return;
    }

    if (command === '.parejas') {
      await handleParejasCommand(chat);
      return;
    }

    // Otros comandos pueden ir aquí

  } catch (err) {
    logEvent('ERROR', 'Error en el procesamiento del comando', { error: err.message });
    try { await chat.sendMessage('⚠️ Error interno, pero sigo activo 😎'); } catch {}
  }
});

client.initialize();

// ---------------------------
// Servidor Express
// ---------------------------
const app = express();
app.get('/', (_, res) => res.send('Bot corriendo'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => logEvent('INFO', 'Servidor Express activo'));
