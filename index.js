const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const prefix = "🐐🇫🇷";

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

// ------------------ QR ------------------
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log(`${prefix} ⚠️ Escanea el QR para iniciar sesión`);
});

// ------------------ READY ------------------
client.on('ready', () => {
    console.log(`${prefix} 🎉 Ya estoy listo para usarse, arriba las Chivas prrs!`);
});

// ------------------ MESSAGE ------------------
client.on('message', async msg => {
    const chat = await msg.getChat();
    const text = msg.body;

    try {
        // ------------------ STICKER ------------------
        if (text.startsWith('.s') && msg.hasMedia) {
            const media = await msg.downloadMedia();
            const ext = media.mimetype.split('/')[1];
            const inputPath = `temp.${ext}`;
            const outputPath = `sticker.webp`;

            fs.writeFileSync(inputPath, media.data, 'base64');

            ffmpeg(inputPath)
                .inputFormat(ext)
                .outputOptions([
                    '-vcodec libwebp',
                    '-lossless 1',
                    '-compression_level 6',
                    '-qscale 75',
                    '-loop 0',
                    '-preset default',
                    '-an',
                    '-t 10',
                    '-vf scale=\'min(720,iw)\':\'min(720,ih)\':force_original_aspect_ratio=decrease,fps=15,format=rgba'
                ])
                .toFormat('webp')
                .save(outputPath)
                .on('end', async () => {
                    const stickerData = fs.readFileSync(outputPath, { encoding: 'base64' });
                    await msg.reply(new MessageMedia('image/webp', stickerData));
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                })
                .on('error', err => {
                    console.error(`${prefix} ❌ Error creando sticker:`, err);
                    msg.reply(`${prefix} ❌ Error creando sticker: ${err.message}`);
                });
        }

        // ------------------ SALUDAR ------------------
        else if (text.startsWith('.saludar')) {
            msg.reply(`${prefix} 👋 Hola! Arriba las Chivas prrs!`);
        }

        // ------------------ INFO ------------------
        else if (text.startsWith('.info')) {
            if(chat.isGroup) {
                msg.reply(`${prefix} 🏟️ Grupo: ${chat.name}\nParticipantes: ${chat.participants.length}`);
            } else {
                msg.reply(`${prefix} ❌ Este comando solo funciona en grupos.`);
            }
        }

        // ------------------ BOT / BOY ------------------
        else if (text.startsWith('.bot') || text.startsWith('.boy')) {
            msg.reply(`${prefix} 🤖 *Comandos de ChivaBot*:
.s + media → Sticker grande/animado
.cerrar → Cerrar grupo solo admin
.abrir → Abrir grupo para todos
.todos → Etiquetar a todos
.notify <mensaje> → Notificar a todos
.hidetag <mensaje> → Mensaje ocultando nombres
.saludar → Saludar al bot
.info → Info del grupo
.mesa4 / .mesa6 <mensaje> → Juego de mesa con 4 o 6 jugadores
.bot / .boy → Mostrar este menú`);
        }

        // ------------------ CERRAR GRUPO ------------------
        else if (text.startsWith('.cerrar')) {
            if(chat.isGroup && chat.participants.find(p => p.id._serialized === msg.author || msg.from === p.id._serialized)?.isAdmin) {
                await chat.setMessagesAdminsOnly(true);
                msg.reply(`${prefix} 🔒 Grupo cerrado para solo admins.`);
            } else {
                msg.reply(`${prefix} ❌ Este comando solo puede usarlo un admin.`);
            }
        }

        // ------------------ ABRIR GRUPO ------------------
        else if (text.startsWith('.abrir')) {
            if(chat.isGroup && chat.participants.find(p => p.id._serialized === msg.author || msg.from === p.id._serialized)?.isAdmin) {
                await chat.setMessagesAdminsOnly(false);
                msg.reply(`${prefix} 🔓 Grupo abierto para todos.`);
            } else {
                msg.reply(`${prefix} ❌ Este comando solo puede usarlo un admin.`);
            }
        }

        // ------------------ TODOS ------------------
        else if (text.startsWith('.todos')) {
            if(chat.isGroup) {
                const mentions = chat.participants.map(p => p.id);
                const messageText = mentions.map(id => `@${id.user}`).join(' ');
                chat.sendMessage(`${prefix} 📢 Todos: ${messageText}`, { mentions: mentions.map(id => ({ id: id })) });
            } else {
                msg.reply(`${prefix} ❌ Este comando solo funciona en grupos.`);
            }
        }

        // ------------------ NOTIFY ------------------
        else if (text.startsWith('.notify')) {
            if(chat.isGroup) {
                const mensaje = text.replace('.notify', '').trim();
                const mentions = chat.participants.map(p => p.id);
                chat.sendMessage(`${prefix} 📣 ${mensaje}`, { mentions: mentions.map(id => ({ id: id })) });
            } else {
                msg.reply(`${prefix} ❌ Este comando solo funciona en grupos.`);
            }
        }

        // ------------------ HIDETAG ------------------
        else if (text.startsWith('.hidetag')) {
            if(chat.isGroup) {
                const mensaje = text.replace('.hidetag', '').trim();
                const mentions = chat.participants.map(p => p.id);
                chat.sendMessage(`${mensaje}`, { mentions: mentions.map(id => ({ id: id })) });
            } else {
                msg.reply(`${prefix} ❌ Este comando solo funciona en grupos.`);
            }
        }

        // ------------------ JUEGO DE MESA ------------------
        else if (text.startsWith('.mesa4') || text.startsWith('.mesa6')) {
            if(chat.isGroup) {
                const [command, ...textParts] = text.split(' ');
                const mesaText = textParts.join(' ');
                const players = command === '.mesa4' ? 4 : 6;
                const mentions = chat.participants.sort(() => 0.5 - Math.random()).slice(0, players);
                const mentionText = mentions.map(p => `@${p.id.user}`).join(' ');
                chat.sendMessage(`${prefix} 🎲 Mesa de ${players} jugadores: ${mentionText}\n${mesaText}`, { mentions });
            } else {
                msg.reply(`${prefix} ❌ Este comando solo funciona en grupos.`);
            }
        }

    } catch (err) {
        console.error(`${prefix} ⚠️ Error al procesar mensaje:`, err);
        msg.reply(`${prefix} ❌ Ocurrió un error interno: ${err.message}`);
    }
});

// ------------------ INIT ------------------
client.initialize();
