// index.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';

const PORT = process.env.PORT || 10000;
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'bot' }),
    puppeteer: { headless: true }
});

// Estado de mesas por chat
const mesas = {}; // { chatId: { jugadores: [], max: number, tema: string } }

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('🐐🇫🇷 ⚠️ Escanea este QR para iniciar sesión');
});

client.on('ready', async () => {
    console.log(`🐐🇫🇷 🎉 Bot activo y listo en puerto ${PORT}!`);
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    for (const group of groups) {
        await group.sendMessage('🐐🇫🇷 🎉 ¡Bot activo y listo para usarse! Usa .bot para ver el menú de comandos.');
    }
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const args = msg.body.split(' ');
    const command = args[0].toLowerCase();
    const text = args.slice(1).join(' ');

    try {
        // Inicio de mesa
        if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
            const maxPlayers = command === '.mesa4' ? 4 : 6;
            mesas[chat.id._serialized] = {
                jugadores: [],
                max: maxPlayers,
                tema: text || '[sin tema]'
            };
            await chat.sendMessage(`🐐🇫🇷 🎲 Mesa para *${maxPlayers} jugadores* iniciada.\nTema: _${text}_\nEscribe *yo* para inscribirte.`);
            return;
        }

        // Inscripción "yo"
        if (msg.body.toLowerCase() === 'yo' && chat.isGroup) {
            const mesa = mesas[chat.id._serialized];
            if (!mesa) return;
            const userId = msg.author || msg.from;
            if (!userId) return;

            if (mesa.jugadores.includes(userId)) {
                await chat.sendMessage(`@${userId.split('@')[0]}, ya estás inscrito.`, { mentions: [userId] });
                return;
            }

            mesa.jugadores.push(userId);
            await chat.sendMessage(`@${userId.split('@')[0]} se ha inscrito (${mesa.jugadores.length}/${mesa.max})`, { mentions: [userId] });

            if (mesa.jugadores.length === mesa.max) {
                const mentionText = mesa.jugadores.map(u => `@${u.split('@')[0]}`).join(' ');
                await chat.sendMessage(`🐐🇫🇷 ✅ Mesa de ${mesa.max} jugadores completa:\n${mentionText}\nTema: _${mesa.tema}_\n¡Vamos con todo!`);
                delete mesas[chat.id._serialized];
            }
            return;
        }

        // Si mesa creada pero sin jugadores inscritos, etiqueta uno para que mande mesa
        const mesaActiva = mesas[chat.id._serialized];
        if (mesaActiva && mesaActiva.jugadores.length === 0 && chat.isGroup) {
            const candidato = chat.participants.find(p => p.id._serialized !== client.info?.wid?._serialized);
            if (candidato) {
                await chat.sendMessage(`@${candidato.id.user}, por favor manda mesa cuando estés listo.`, { mentions: [candidato.id._serialized] });
            }
        }

        // Comando menú
        if (command === '.bot') {
            let menu = `🐐🇫🇷 *Menú de comandos*\n\n`;
            menu += `.bot - Mostrar este menú\n`;
            menu += `.todos - Etiquetar a todos los miembros\n`;
            menu += `.hidetag <mensaje> - Enviar mensaje ocultando menciones\n`;
            menu += `.notify <mensaje> - Notificar a todos\n`;
            menu += `.mesa4/.mesa6 <mensaje> - Crear mesa de 4 o 6 jugadores\n`;
            menu += `.sticker <imagen/video> - Crear sticker\n`;
            await chat.sendMessage(menu);
        }

        // Comando .todos mejorado
        if (command === '.todos' && chat.isGroup) {
            const mentions = chat.participants.map(p => p.id._serialized);
            const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
            const messageText =
                `🐐🇫🇷 *¡Atención Chivas!* 📣\n` +
                `_Etiquetando a todos los miembros:_\n\n` +
                `${mentionLines}\n\n` +
                `¡Vamos con todo! 🔥`;
            await chat.sendMessage(messageText, { mentions });
        }

        // Comando .hidetag
        if (command === '.hidetag' && chat.isGroup) {
            const mentions = chat.participants.map(p => p.id._serialized);
            await chat.sendMessage(text, { mentions });
        }

        // Comando .notify
        if (command === '.notify' && chat.isGroup) {
            const mentions = chat.participants.map(p => p.id._serialized);
            const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
            const messageText =
                `🐐🇫🇷 📣 Notificación a todos:\n\n${mentionText}\n\n${text}`;
            await chat.sendMessage(messageText, { mentions });
        }

        // Comando .sticker
        if (command === '.sticker') {
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                await chat.sendMessage(media, { sendMediaAsSticker: true });
            } else {
                await chat.sendMessage('❌ Por favor envía una imagen o video con el comando .sticker');
            }
        }

    } catch (err) {
        console.error('⚠️ Error procesando mensaje:', err);
        await chat.sendMessage('🐐🇫🇷 ⚠️ Ocurrió un error, revisa el comando e intenta de nuevo.');
    }
});

client.initialize();

// Express server para Render
const app = express();
app.get('/', (req, res) => res.send('🐐🇫🇷 Bot activo y corriendo.'));
app.listen(PORT, () => console.log(`Servidor HTTP escuchando en puerto ${PORT}`));
