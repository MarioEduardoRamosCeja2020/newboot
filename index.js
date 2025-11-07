const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const stream = require('stream');
const sharp = require('sharp');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3003;
app.get('/', (req, res) => res.send('🐐🇫🇷 🤖 Bot WhatsApp activo'));
app.listen(PORT, () => console.log(`🐐🇫🇷 ✅ Servidor activo en puerto ${PORT}`));

// --------------------- CLIENTE ---------------------
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'bot-admin' }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
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

// --------------------- COMANDOS ---------------------
client.on('message', async msg => {
    try {
        const chat = await msg.getChat();
        const text = msg.body.trim();
        const isGroup = chat.isGroup;

        // ---------- Ping ----------
        if (text === '.ping') return msg.reply('🐐🇫🇷 🏓 Pong! El bot está activo');

        // ---------- Comandos de grupo ----------
        if (isGroup && (text.startsWith('.todos') || text.startsWith('.hidetag') || text.startsWith('.notify'))) {
            const command = text.split(' ')[0];
            const message = text.replace(command, '').trim() || '🐐🇫🇷 👋 ¡Hola a todos!';
            return chat.sendMessage(message, { mentions: chat.participants.map(p => p.id) });
        }

        // ---------- Stickers ----------
        if (text.startsWith('.s')) {
            if (!msg.hasMedia) return msg.reply('🐐🇫🇷 📸 Envía una imagen o video con el comando `.s`');
            const media = await msg.downloadMedia();
            const imageBuffer = Buffer.from(media.data, 'base64');
            const stickerBuffer = await sharp(imageBuffer)
                .resize(512, 512, { fit: 'inside' })
                .webp()
                .toBuffer();
            const sticker = new MessageMedia('image/webp', stickerBuffer.toString('base64'));
            return chat.sendMessage(sticker, { sendMediaAsSticker: true });
        }

        // ---------- YouTube Audio Optimizado ----------
        if (text.startsWith('.yt')) {
            const query = text.replace('.yt', '').trim();
            if (!query) return msg.reply('🐐🇫🇷 🎵 Escribe el nombre de la canción o artista.\nEjemplo: `.yt Shakira Hips Don’t Lie`');

            msg.reply(`🐐🇫🇷 🔍 Buscando "${query}" en YouTube...`);
            const searchResult = await ytSearch(query);
            if (!searchResult || !searchResult.videos.length) return msg.reply('🐐🇫🇷 ❌ No encontré resultados 😢');

            const url = searchResult.videos[0].url;
            const info = await ytdl.getInfo(url);

            msg.reply(`🐐🇫🇷 🎧 Descargando "${info.videoDetails.title}"...`);

            // Creamos un buffer stream con ffmpeg para mp3
            const passThrough = new stream.PassThrough();
            ffmpeg(ytdl(url, { filter: 'audioonly' }))
                .audioBitrate(128)
                .format('mp3')
                .pipe(passThrough);

            const chunks = [];
            passThrough.on('data', chunk => chunks.push(chunk));
            passThrough.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const media = new MessageMedia('audio/mpeg', buffer.toString('base64'), `${info.videoDetails.title}.mp3`);
                await chat.sendMessage(media, { caption: `🐐🇫🇷 🎶 ${info.videoDetails.title}` });
            });
            passThrough.on('error', err => {
                console.error('🐐🇫🇷 ⚠️ Error descargando audio:', err);
                msg.reply('🐐🇫🇷 ⚠️ Ocurrió un error al descargar el audio.');
            });
        }

        // ---------- Juego de mesa ----------
        if (text.startsWith('.mesa4') || text.startsWith('.mesa6')) {
            const [command, ...textParts] = text.split(' ');
            const extraText = textParts.join(' ');
            const players = command === '.mesa4' ? 4 : 6;
            const mentions = chat.participants.sort(() => 0.5 - Math.random()).slice(0, players);
            const mentionText = mentions.map(p => `@${p.id.user}`).join(' ');
            return chat.sendMessage(`🐐🇫🇷 🎲 Mesa de ${players}: ${mentionText}\n${extraText}`, { mentions });
        }

        // ---------- Menú ----------
        if (text === '.boy') {
            return chat.sendMessage(
`🐐🇫🇷 📜 *Menú de comandos*:
.ping - Revisar si el bot está activo
.todos / .hidetag / .notify - Mencionar a todos en el grupo
.s - Convertir imagen/video en sticker
.yt [nombre canción] - Descargar audio de YouTube
.mesa4 / .mesa6 [texto] - Juego de mesa
.cerrar - Cerrar grupo (solo admins)
.abrir - Abrir grupo (solo admins)

Ejemplo: .yt Shakira Hips Don’t Lie`
            );
        }

        // ---------- Cerrar/Abrir grupo ----------
        if (isGroup && (text === '.cerrar' || text === '.abrir')) {
            if (!chat.isGroup) return msg.reply('🐐🇫🇷 ❌ Este comando solo funciona en grupos');
            const sender = chat.participants.find(p => p.id._serialized === msg.author || p.id._serialized === msg.from);
            if (!sender?.isAdmin) return msg.reply('🐐🇫🇷 ❌ Solo administradores pueden usar este comando');
            await chat.setMessagesAdminsOnly(text === '.cerrar');
            return msg.reply(`🐐🇫🇷 ✅ Grupo ${text === '.cerrar' ? 'cerrado' : 'abierto'} para mensajes`);
        }

    } catch (err) {
        console.error('🐐🇫🇷 ❌ Ocurrió un error interno:', err);
        msg.reply(`🐐🇫🇷 ❌ Ocurrió un error interno: ${err.message}`);
    }
});
