// index.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const ytdl = require('ytdl-core');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// --------------------- EXPRESS PARA PING ---------------------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/ping', (req, res) => res.send('Bot activo ✅'));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

// --------------------- CLIENTE DE WHATSAPP ---------------------
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'bot-admin' }),
    puppeteer: { headless: true }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
    console.log('🤖 Bot conectado a WhatsApp Web');
});

// --------------------- COMANDOS DEL BOT ---------------------
client.on('message', async msg => {
    const chat = await msg.getChat();
    const isGroup = chat.isGroup;

    // --------- COMANDOS DEL GRUPO ---------
    if (msg.body.startsWith('.todos') && isGroup) {
        let text = msg.body.replace('.todos', '').trim() || '¡Hola a todos!';
        chat.sendMessage(text, { mentions: chat.participants.map(p => p.id) });
    }

    if (msg.body.startsWith('.hidetag') && isGroup) {
        let text = msg.body.replace('.hidetag', '').trim() || 'Mensaje para todos';
        chat.sendMessage(text, { mentions: chat.participants.map(p => p.id) });
    }

    if (msg.body.startsWith('.notify') && isGroup) {
        let text = msg.body.replace('.notify', '').trim() || 'Atención!';
        chat.sendMessage(text, { mentions: chat.participants.map(p => p.id) });
    }

    // --------- STICKERS ---------
    if (msg.body.startsWith('.s')) {
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const mediaPath = path.join('./temp', `temp.${media.mimetype.split('/')[1]}`);
            fs.writeFileSync(mediaPath, Buffer.from(media.data, 'base64'));

            const stickerPath = path.join('./temp', 'sticker.webp');
            ffmpeg(mediaPath)
                .outputOptions(['-vcodec libwebp', '-vf scale=512:512:force_original_aspect_ratio=decrease'])
                .save(stickerPath)
                .on('end', async () => {
                    const sticker = MessageMedia.fromFilePath(stickerPath);
                    chat.sendMessage(sticker, { sendMediaAsSticker: true });
                    fs.unlinkSync(mediaPath);
                    fs.unlinkSync(stickerPath);
                });
        }
    }

    // --------- YOUTUBE A AUDIO ---------
    if (msg.body.startsWith('.yt')) {
        const url = msg.body.replace('.yt', '').trim();
        if (ytdl.validateURL(url)) {
            const info = await ytdl.getInfo(url);
            const audioPath = path.join('./temp', `${info.videoDetails.title}.mp3`);
            ytdl(url, { filter: 'audioonly' }).pipe(fs.createWriteStream(audioPath))
                .on('finish', () => {
                    const media = MessageMedia.fromFilePath(audioPath);
                    chat.sendMessage(media);
                    fs.unlinkSync(audioPath);
                });
        } else {
            chat.sendMessage('URL inválida 😅');
        }
    }

    // --------- JUEGO DE MESA ---------
    if (msg.body.startsWith('.mesa4') || msg.body.startsWith('.mesa6')) {
        const [command, ...textParts] = msg.body.split(' ');
        const text = textParts.join(' ');
        const players = command === '.mesa4' ? 4 : 6;
        const mentions = chat.participants.sort(() => 0.5 - Math.random()).slice(0, players);
        const mentionText = mentions.map(p => `@${p.id.user}`).join(' ');
        chat.sendMessage(`Mesa de ${players}: ${mentionText}\n${text}`, { mentions });
    }
});

// --------------------- INICIAR CLIENTE ---------------------
client.initialize();
