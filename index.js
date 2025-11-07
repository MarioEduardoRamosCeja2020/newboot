const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { exec } = require('child_process');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session', clientId: "client1" }),
    puppeteer: { headless: true }
});

// Mensaje al iniciar
client.on('ready', () => {
    console.log('🐐🇫🇷 🎉 Ya estoy listo para usarse, arriba las Chivas prrs!');
});

// Evitar crashes por errores inesperados
process.on('uncaughtException', function (err) {
    if (err.code === 'EBUSY') {
        console.warn('⚠️ Archivo de sesión ocupado, ignorando...');
    } else {
        console.error(err);
    }
});

client.on('message', async msg => {
    const chat = await msg.getChat();

    // ---- Sticker de imagen o video ----
    if (msg.body.startsWith('.sticker') && msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            const buffer = Buffer.from(media.data, 'base64');
            const tempFile = path.join(__dirname, 'temp');
            let outputFile = tempFile + '.webp';

            if (media.mimetype.includes('image')) {
                await sharp(buffer)
                    .resize(512, 512, { fit: 'contain' })
                    .toFile(outputFile);
                const sticker = MessageMedia.fromFilePath(outputFile);
                await chat.sendMessage(sticker, { sendMediaAsSticker: true });
            } else if (media.mimetype.includes('video')) {
                const inputVideo = tempFile + '.mp4';
                fs.writeFileSync(inputVideo, buffer);
                outputFile = tempFile + '.webp';

                // Convertir video a sticker
                await new Promise((resolve, reject) => {
                    exec(`ffmpeg -i "${inputVideo}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,format=rgba" -loop 0 "${outputFile}"`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                const sticker = MessageMedia.fromFilePath(outputFile);
                await chat.sendMessage(sticker, { sendMediaAsSticker: true });
                fs.unlinkSync(inputVideo);
            }

            fs.unlinkSync(outputFile);
        } catch (e) {
            console.error('❌ Error creando sticker:', e);
            chat.sendMessage('🐐🇫🇷 ❌ Error creando sticker, revisa el archivo.');
        }
    }

    // ---- .todos ----
    if (msg.body === '.todos' && chat.isGroup) {
        const mentions = chat.participants.map(p => p.id._serialized);
        const mentionText = mentions.map(u => `@${u.split('@')[0]}`).join(' ');
        chat.sendMessage(`🐐🇫🇷 Todos: ${mentionText}`, { mentions: chat.participants });
    }

    // ---- .notify ----
    if (msg.body.startsWith('.notify') && chat.isGroup) {
        const parts = msg.body.split(' ');
        const number = parts[1];
        const user = chat.participants.find(p => p.id.user === number);
        if (user) await chat.sendMessage(`🐐🇫🇷 @${user.id.user}`, { mentions: [user] });
    }

    // ---- .hidetag ----
    if (msg.body.startsWith('.hidetag') && chat.isGroup) {
        const text = msg.body.replace('.hidetag', '').trim();
        await chat.sendMessage(text, { mentions: chat.participants });
    }

    // ---- Abrir / Cerrar grupo ----
    if (msg.body === '.abrir grupo' && chat.isGroup) await chat.setMessagesAdminsOnly(false);
    if (msg.body === '.cerrar grupo' && chat.isGroup) await chat.setMessagesAdminsOnly(true);

    // ---- .boy (menú de comandos) ----
    if (msg.body === '.boy') {
        chat.sendMessage(
`🐐🇫🇷 Menú de comandos:
.sticker -> crea sticker de imagen o video
.todos -> etiqueta a todos
.notify <num> -> notifica a un usuario
.hidetag -> mensaje ocultando a todos
.abrir grupo / .cerrar grupo -> control del chat
.mesa4 / .mesa6 -> juego de mesa con menciones`
        );
    }

    // ---- Juego de mesa ----
    if (msg.body.startsWith('.mesa4') || msg.body.startsWith('.mesa6')) {
        const [command, ...textParts] = msg.body.split(' ');
        const text = textParts.join(' ');
        const players = command === '.mesa4' ? 4 : 6;
        const mentions = chat.participants.sort(() => 0.5 - Math.random()).slice(0, players);
        const mentionText = mentions.map(p => `@${p.id.user}`).join(' ');
        chat.sendMessage(`🐐🇫🇷 Mesa de ${players}: ${mentionText}\n${text}`, { mentions });
    }
});

client.initialize();
