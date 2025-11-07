import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';

const PORT = process.env.PORT || 10000;
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'bot' }),
    puppeteer: { headless: true }
});

const mesas = {};    // { [chatId]: { jugadores: [], max: number, tema: string } }
const parejas = {};  // { [chatId]: [userId1, userId2] }

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
    const text = args.slice(1).join(' ').trim();

    try {
        // --- Función .formarpareja ---
        if (command === '.formarpareja' && chat.isGroup) {
            const participantes = chat.participants.map(p => p.id._serialized);
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
              `🐐🇫🇷 ❤️ ¡Felicitaciones a la pareja más linda del grupo! ${mentionText}\n_Que su amistad (o lo que venga) brille con todo._`,
              { mentions: [user1, user2] }
            );
            return;
        }

        // --- Inicio de mesa (.mesa4 o .mesa6) ---
        if ((command === '.mesa4' || command === '.mesa6') && chat.isGroup) {
            const maxPlayers = (command === '.mesa4') ? 4 : 6;
            mesas[chat.id._serialized] = {
                jugadores: [],
                max: maxPlayers,
                tema: text || '[sin tema]'
            };
            await chat.sendMessage(`🐐🇫🇷 🎲 Mesa para *${maxPlayers} jugadores* iniciada.\nTema: _${text}_\nEscribe *yo* para inscribirte.`);
            return;
        }

        // --- Inscripción “yo” para mesas ---
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
                const mentionsArr = mesa.jugadores;
                const mentionText = mentionsArr.map(u => `@${u.split('@')[0]}`).join(' ');
                await chat.sendMessage(`🐐🇫🇷 ✅ Mesa de ${mesa.max} jugadores completa:\n${mentionText}\nTema: _${mesa.tema}_\n¡Vamos con todo!`, { mentions: mentionsArr });

                // Elegir uno de los inscritos para que “mande mesa”
                const encargado = mentionsArr[0];
                await chat.sendMessage(`@${encargado.split('@')[0]}, por favor *manda mesa*.`, { mentions: [encargado] });

                delete mesas[chat.id._serialized];
            }
            return;
        }

        // --- Menú de comandos (.bot) ---
        if (command === '.bot') {
            let menu = `🐐🇫🇷 *Menú de comandos*\n\n`;
            menu += `.bot - Mostrar este menú\n`;
            menu += `.todos - Etiquetar a todos los miembros\n`;
            menu += `.hidetag <mensaje> - Enviar mensaje ocultando menciones\n`;
            menu += `.notify <mensaje> - Notificar a todos\n`;
            menu += `.mesa4/.mesa6 <mensaje> - Crear mesa de 4 o 6 jugadores\n`;
            menu += `.formarpareja - Formar pareja al azar y felicitar\n`;
            menu += `.sticker <imagen/video> - Crear sticker\n`;
            await chat.sendMessage(menu);
            return;
        }

        // --- Comando .todos con formato mejorado ---
        if (command === '.todos' && chat.isGroup) {
            const mentions = chat.participants.map(p => p.id._serialized);
            const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
            const messageText =
                `🐐🇫🇷 *¡Atención Chivas!* 📣\n` +
                `_Etiquetando a todos los miembros:_\n\n` +
                `${mentionLines}\n\n` +
                `¡Vamos con todo! 🔥`;
            await chat.sendMessage(messageText, { mentions });
            return;
        }

        // --- Comando .hidetag ---
        if (command === '.hidetag' && chat.isGroup) {
            const mentions = chat.participants.map(p => p.id._serialized);
            await chat.sendMessage(text, { mentions });
            return;
        }

        // --- Comando .notify ---
        if (command === '.notify' && chat.isGroup) {
            const mentions = chat.participants.map(p => p.id._serialized);
            const mentionLines = mentions.map(m => `@${m.split('@')[0]}`).join('\n');
            const messageText =
                `🐐🇫🇷 📣 Notificación a todos:\n\n${mentionLines}\n\n${text}`;
            await chat.sendMessage(messageText, { mentions });
            return;
        }

        // --- Comando .sticker ---
        if (command === '.sticker') {
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                await chat.sendMessage(media, { sendMediaAsSticker: true });
            } else {
                await chat.sendMessage('❌ Por favor envía una imagen o video con el comando .sticker');
            }
            return;
        }

    } catch (err) {
        console.error('⚠️ Error procesando mensaje:', err);
        await chat.sendMessage('🐐🇫🇷 ⚠️ Ocurrió un error, revisa el comando e intenta de nuevo.');
    }
});

client.initialize();

// Servidor Express para mantener vivo el bot en hosting tipo Render
const app = express();
app.get('/', (req, res) => res.send('🐐🇫🇷 Bot activo y corriendo.'));
app.listen(PORT, () => console.log(`Servidor HTTP escuchando en puerto ${PORT}`));
