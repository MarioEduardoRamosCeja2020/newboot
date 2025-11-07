import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';
import os from 'os';

const PORT = process.env.PORT || 10000;
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot' }),
  puppeteer: { headless: true, args: ['--no‑sandbox','--disable‑setuid‑sandbox','--disable-dev-shm-usage'] }
});

const mesas = {};
const parejas = {};

function isValidUserId(id) {
  return typeof id === 'string' && id.includes('@');
}

let lastMessageTimestamp = Date.now();

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('🐐🇫🇷 ⚠️ Escanea este QR para iniciar sesión');
});

client.on('ready', async () => {
  console.log(`🐐🇫🇷 🎉 Bot activo y listo en puerto ${PORT}!`);
  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  for (const group of groups) {
    try {
      await group.sendMessage('🐐🇫🇷 🎉 ¡Bot activo y listo para usarse! Usa .bot para ver el menú de comandos.');
    } catch(err) {
      console.warn('No se pudo notificar al grupo', group.id._serialized, err);
    }
  }
});

// Monitorización de recursos
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
    console.log(`🐐🇫🇷 MONITOR — Memoria: heapUsed=${heapUsedMB}MB heapTotal=${heapTotalMB}MB rss=${rssMB}MB | CPU load: ${load} | Event‑loop lag: ${lagMs}ms`);

    // Si el lag es alto o memoria muy grande, puedes reiniciar
    if (lagMs > 200 || parseFloat(heapUsedMB) > 300) {
      console.warn('🐐🇫🇷 ⚠️ Umbral de carga alcanzado — reiniciando cliente.');
      client.destroy();
      client.initialize();
    }
  });
}, 60 * 1000);  // cada 1 minuto

client.on('message', async msg => {
  lastMessageTimestamp = Date.now();
  const chat = await msg.getChat();
  if (!chat) return;
  const raw = msg.body || '';
  const args = raw.trim().split(' ');
  const command = args[0].toLowerCase();
  const text = args.slice(1).join(' ').trim();

  try {
    // .formarpareja
    if (command === '.formarpareja' && chat.isGroup) {
      const participantes = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (participantes.length < 2) {
        await chat.sendMessage('🐐🇫🇷 ⚠️ No hay suficientes miembros para formar una pareja.');
        return;
      }
      const user1 = participantes[Math.floor(Math.random() * participantes.length)];
      let user2 = participantes[Math.floor(Math.random() * participantes.length)];
      while (user2 === user1) {
        user2 = participantes[Math.floor(Math.random() * participantes.length)];
      }
      parejas[chat.id._serialized] = [user1, user2];
      const mentionText = `@${user1.split('@')[0]} & @${user2.split('@')[0]}`;
      await chat.sendMessage(
        `🐐🇫🇷 ❤️ ¡Felicitaciones a la pareja más linda del grupo! ${mentionText}\n_Que su amistad brille con todo._`,
        { mentions: [user1, user2] }
      );
      return;
    }

    // .mesa4 / .mesa6
    if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
      const maxPlayers = (command === '.mesa4') ? 4 : 6;
      mesas[chat.id._serialized] = { jugadores: [], max: maxPlayers, tema: text || '[sin tema]' };
      await chat.sendMessage(`🐐🇫🇷 🎲 Mesa para *${maxPlayers} jugadores* iniciada.\nTema: _${text}_\nEscribe *yo* para inscribirte.`);
      return;
    }

    // Inscripción “yo”
    if (raw.toLowerCase() === 'yo' && chat.isGroup) {
      const mesa = mesas[chat.id._serialized];
      if (!mesa) return;
      const userId = msg.author || msg.from;
      if (!isValidUserId(userId)) return;

      if (mesa.jugadores.includes(userId)) {
        await chat.sendMessage(`@${userId.split('@')[0]}, ya estás inscrito.`, { mentions: [userId] });
        return;
      }

      mesa.jugadores.push(userId);
      await chat.sendMessage(`@${userId.split('@')[0]} se ha inscrito (${mesa.jugadores.length}/${mesa.max})`, { mentions: [userId] });

      if (mesa.jugadores.length === mesa.max) {
        const arr = mesa.jugadores;
        const mentionText = arr.map(u => `@${u.split('@')[0]}`).join(' ');
        await chat.sendMessage(`🐐🇫🇷 ✅ Mesa de ${mesa.max} jugadores completa:\n${mentionText}\nTema: _${mesa.tema}_\n¡Vamos con todo!`, { mentions: arr });

        const encargado = arr[0];
        await chat.sendMessage(`@${encargado.split('@')[0]}, por favor *manda mesa*.`, { mentions: [encargado] });

        delete mesas[chat.id._serialized];
      }
      return;
    }

    // .bot menú
    if (command === '.bot') {
      let menu = `🐐🇫🇷 *Menú de comandos*\n\n`;
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

    // .todos
    if (command === '.todos' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (!mentions.length) return;
      const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
      const messageText = `🐐🇫🇷 *¡Atención Chivas!* 📣\n_Etiquetando a todos los miembros:_\n\n${mentionLines}\n\n¡Vamos con todo! 🔥`;
      await chat.sendMessage(messageText, { mentions });
      return;
    }

    // .hidetag
    if (command === '.hidetag' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (!text) {
        await chat.sendMessage('🐐🇫🇷 ⚠️ Debes indicar el mensaje después del comando .hidetag.');
        return;
      }
      await chat.sendMessage(text, { mentions });
      return;
    }

    // .notify
    if (command === '.notify' && chat.isGroup) {
      const mentions = chat.participants.map(p => p.id._serialized).filter(isValidUserId);
      if (!text) {
        await chat.sendMessage('🐐🇫🇷 ⚠️ Debes indicar el mensaje después del comando .notify.');
        return;
      }
      const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
      const messageText = `🐐🇫🇷 📣 Notificación a todos:\n\n${mentionLines}\n\n${text}`;
      await chat.sendMessage(messageText, { mentions });
      return;
    }

    // .sticker
    if (command === '.sticker') {
      if (!msg.hasMedia) {
        await chat.sendMessage('❌ Por favor envía una imagen o video con el comando .sticker.');
        return;
      }
      try {
        const media = await msg.downloadMedia();
        await chat.sendMessage(media, { sendMediaAsSticker: true });
      } catch(e) {
        console.error('⚠️ Error al crear sticker:', e);
        await chat.sendMessage('🐐🇫🇷 ⚠️ Ocurrió un error al crear el sticker.');
      }
      return;
    }

  } catch (err) {
    console.error('⚠️ Error procesando mensaje:', err);
    await chat.sendMessage('🐐🇫🇷 ⚠️ Ocurrió un error interno, inténtalo de nuevo.');
  }
});

client.initialize();

const app = express();
app.get('/', (req, res) => res.send('🐐🇫🇷 Bot activo y corriendo.'));
app.listen(PORT, () => console.log(`Servidor HTTP escuchando en puerto ${PORT}`));
