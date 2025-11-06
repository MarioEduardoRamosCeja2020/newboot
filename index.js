// index.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const ytdl = require('ytdl-core');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

// Configurar ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// --------------------- EXPRESS PARA PING ---------------------
const app = express();
const PORT = process.env.PORT || 3003;
app.get('/', (req, res) => res.send('🤖 Bot WhatsApp activo'));
app.listen(PORT, () => console.log(`✅ Servidor activo en puerto ${PORT}`));

// --------------------- CLIENTE DE WHATSAPP ---------------------
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
        headless: true
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🤖 Bot conectado a WhatsApp Web'));
client.initialize();

// --------------------- COMANDOS DEL BOT ---------------------
client.on('message', async msg => {
    const chat = await msg.getChat();

    // Comando ping
    if (msg.body === '.ping') {
        msg.reply('🏓 Pong! El bot está activo');
    }

    // Descargar audio de YouTube
    if (msg.body.startsWith('.yt')) {
        const url = msg.body.split(' ')[1];
        if (!ytdl.validateURL(url)) return msg.reply('❌ URL inválida');
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        const filePath = path.join(__dirname, 'temp', `${title}.mp3`);

        ytdl(url, { filter: 'audioonly' })
            .pipe(fs.createWriteStream(filePath))
            .on('finish', async () => {
                const media = MessageMedia.fromFilePath(filePath);
                await chat.sendMessage(media, { caption: `🎧 ${info.videoDetails.title}` });
                fs.unlinkSync(filePath);
            });
    }
});
