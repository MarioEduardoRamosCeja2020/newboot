const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

// --------------------- EXPRESS PARA PING ---------------------
const app = express();
const PORT = process.env.PORT || 3003;
app.get('/', (req, res) => res.send('🐐🇫🇷 🤖 Bot WhatsApp activo'));
app.listen(PORT, () => console.log(`✅ Servidor activo en puerto ${PORT}`));

// --------------------- CLIENTE DE WHATSAPP ---------------------
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'bot-admin', dataPath: './session/' }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🐐🇫🇷 🤖 Bot conectado a WhatsApp Web'));
client.on('authenticated', () => console.log('🐐🇫🇷 ✅ Sesión autenticada'));
client.on('auth_failure', msg => console.error('🐐🇫🇷 ❌ Error de autenticación:', msg));
client.on('disconnected', reason => {
    console.warn('🐐🇫🇷 ⚠️ Cliente desconectado:', reason);
    client.initialize();
});

client.initialize();

// --------------------- CAPTURA DE ERRORES GLOBALES ---------------------
process.on('uncaughtException', (err) => {
    console.error('🐐🇫🇷 ⚠️ Excepción no atrapada:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🐐🇫🇷 ⚠️ Rechazo de promesa no manejado:', reason);
});

// --------------------- COMANDOS DEL BOT ---------------------
client.on('message', async msg => {
    try {
        const chat = await msg.getChat();
        const text = msg.body.trim();
        const isGroup = chat.isGroup;

        // --------- .ping ---------
        if (text === '.ping') return msg.reply('🐐🇫🇷 🏓 Pong! El bot está activo');

        // --------- Comandos de grupo (.todos / .hidetag / .notify) ---------
        if (isGroup && (text.startsWith('.todos') || text.startsWith('.hidetag') || text.startsWith('.notify'))) {
            const command = text.split(' ')[0];
            const message = text.replace(command, '').trim() || '👋 ¡Hola a todos!';
            await chat.sendMessage(`🐐🇫🇷 ${message}`, { mentions: chat.participants.map(p => p.id) });
        }

        // --------- Crear sticker (.s) ---------
        if (text.startsWith('.s')) {
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                const ext = media.mimetype.split('/')[1];
                const tempDir = path.join(__dirname, 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                const mediaPath = path.join(tempDir, `temp.${ext}`);
                const stickerPath = path.join(tempDir, 'sticker.webp');
                fs.writeFileSync(mediaPath, Buffer.from(media.data, 'base64'));

                ffmpeg(mediaPath)
                    .outputOptions(['-vcodec libwebp', '-vf scale=512:512:force_original_aspect_ratio=decrease'])
                    .save(stickerPath)
                    .on('end', async () => {
                        const sticker = MessageMedia.fromFilePath(stickerPath);
                        await chat.sendMessage(sticker, { sendMediaAsSticker: true });
                        fs.unlinkSync(mediaPath);
                        fs.unlinkSync(stickerPath);
                    })
                    .on('error', err => console.error('🐐🇫🇷 Error creando sticker:', err));
            } else {
                msg.reply('🐐🇫🇷 📸 Envía una imagen o video con `.s` para convertirlo en sticker.');
            }
        }

        // --------- Descargar música de YouTube (.yt) ---------
        if (text.startsWith('.yt')) {
            const query = text.replace('.yt', '').trim();
            if (!query) return msg.reply('🐐🇫🇷 🎵 Escribe el nombre de la canción o artista.\nEjemplo: `.yt Shakira Hips Don’t Lie`');

            let url;
            if (ytdl.validateURL(query)) {
                url = query;
            } else {
                msg.reply(`🐐🇫🇷 🔍 Buscando "${query}" en YouTube...`);
                const searchResult = await ytSearch(query);
                if (!searchResult || !searchResult.videos.length) return msg.reply('🐐🇫🇷 ❌ No encontré resultados 😢 intenta con otro nombre.');
                url = searchResult.videos[0].url;
            }

            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const filePath = path.join(tempDir, `${title}.mp3`);
            msg.reply(`🐐🇫🇷 🎧 Descargando "${info.videoDetails.title}"... espera un momento.`);

            ytdl(url, { filter: 'audioonly' })
                .pipe(fs.createWriteStream(filePath))
                .on('finish', async () => {
                    const media = MessageMedia.fromFilePath(filePath);
                    await chat.sendMessage(media, { caption: `🐐🇫🇷 🎶 ${info.videoDetails.title}` });
                    fs.unlinkSync(filePath);
                })
                .on('error', err => {
                    console.error('🐐🇫🇷 Error descargando audio:', err);
                    msg.reply('🐐🇫🇷 ⚠️ Ocurrió un error al descargar el audio.');
                });
        }

        // --------- Juegos de mesa (.mesa4 / .mesa6) ---------
        if (text.startsWith('.mesa4') || text.startsWith('.mesa6')) {
            const [command, ...textParts] = text.split(' ');
            const extraText = textParts.join(' ');
            const players = command === '.mesa4' ? 4 : 6;
            const mentions = chat.participants.sort(() => 0.5 - Math.random()).slice(0, players);
            const mentionText = mentions.map(p => `@${p.id.user}`).join(' ');
            chat.sendMessage(`🐐🇫🇷 🎲 Mesa de ${players}: ${mentionText}\n${extraText}`, { mentions });
        }

        // --------- Abrir / Cerrar grupo ---------
        if (isGroup && text === '.abrir') {
            await chat.setMessagesAdminsOnly(false);
            msg.reply('🐐🇫🇷 ✅ Grupo abierto para todos');
        }
        if (isGroup && text === '.cerrar') {
            await chat.setMessagesAdminsOnly(true);
            msg.reply('🐐🇫🇷 ✅ Grupo cerrado (solo admins pueden enviar mensajes)');
        }

        // --------- Mostrar menú de comandos (.boy) ---------
        if (text === '.boy') {
            const menu = `
🐐🇫🇷 🤖 *Menú de Comandos*

📌 .ping - Verifica que el bot está activo
📌 .s - Envía una imagen/video para convertirlo en sticker
📌 .yt [canción] - Descargar audio de YouTube
📌 .mesa4 / .mesa6 - Crear mesa de 4 o 6 jugadores en grupo
📌 .todos / .hidetag / .notify - Mencionar a todos en el grupo
📌 .abrir / .cerrar - Abrir o cerrar grupo (solo admins)
📌 .boy - Mostrar este menú

Ejemplo: 🐐🇫🇷 .yt Shakira Hips Don’t Lie
`;
            msg.reply(menu);
        }

    } catch (error) {
        console.error('🐐🇫🇷 ⚠️ Error al procesar mensaje:', error);
        msg.reply(`🐐🇫🇷 ❌ Ocurrió un error interno: ${error.message}`);
    }
});
