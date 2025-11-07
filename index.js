const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot" }),
    puppeteer: { headless: true }
});

client.on('qr', qr => {
    console.log('🐐🇫🇷 ⚠️ Escanea el QR para iniciar sesión');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('🐐🇫🇷 🎉 Ya estoy listo para usarse, arriba las Chivas prrs!');

    // Aviso a un grupo si quieres
    const chats = await client.getChats();
    const grupo = chats.find(c => c.isGroup);
    if(grupo) {
        grupo.sendMessage('🐐🇫🇷 🎉 ¡El bot está activo! Usa .bot para ver los comandos.');
    }
});

client.on('message', async msg => {
    const chat = await msg.getChat();

    // --------- MENÚ BOT ---------
    if(msg.body === '.bot') {
        let menu = `🐐🇫🇷 *Menú de comandos*\n\n`;
        menu += `.todos - Etiquetar a todos\n`;
        menu += `.notify <texto> - Notificar a todos\n`;
        menu += `.hidetag <texto> - Mensaje oculto etiquetando a todos\n`;
        menu += `.mesa4 <texto> - Crear mesa de 4\n`;
        menu += `.mesa6 <texto> - Crear mesa de 6\n`;
        menu += `.sticker - Crear sticker de imagen, video o GIF\n`;
        chat.sendMessage(menu);
    }

    // --------- ETIQUETAS ---------
    if(msg.body.startsWith('.todos')) {
        if(!chat.isGroup) return;
        const mentionObjects = chat.participants.map(p => p.id);
        const mentionText = mentionObjects.map(u => `@${u.user}`).join(' ');
        chat.sendMessage(mentionText, { mentions: mentionObjects });
    }

    if(msg.body.startsWith('.notify')) {
        if(!chat.isGroup) return;
        const text = msg.body.slice(8).trim();
        const mentionObjects = chat.participants.map(p => p.id);
        chat.sendMessage(text, { mentions: mentionObjects });
    }

    if(msg.body.startsWith('.hidetag')) {
        if(!chat.isGroup) return;
        const text = msg.body.slice(8).trim();
        const mentionObjects = chat.participants.map(p => p.id);
        chat.sendMessage(text, { mentions: mentionObjects, sendSeen: false });
    }

    // --------- JUEGO DE MESA ---------
    if (msg.body.startsWith('.mesa4') || msg.body.startsWith('.mesa6')) {
        if(!chat.isGroup) return;
        const [command, ...textParts] = msg.body.split(' ');
        const text = textParts.join(' ');
        const players = command === '.mesa4' ? 4 : 6;
        const mentions = chat.participants.sort(() => 0.5 - Math.random()).slice(0, players);
        const mentionText = mentions.map(p => `@${p.id.user}`).join(' ');
        chat.sendMessage(`Mesa de ${players}: ${mentionText}\n${text}`, { mentions });
    }

    // --------- STICKER AVANZADO ---------
    if(msg.body.startsWith('.sticker') && msg.hasMedia) {
        const media = await msg.downloadMedia();
        const buffer = Buffer.from(media.data, 'base64');
        const tempFile = path.join(__dirname, `temp_${Date.now()}.${media.mimetype.split('/')[1]}`);

        fs.writeFileSync(tempFile, buffer);

        if(media.mimetype.startsWith('video') || media.mimetype === 'image/gif') {
            const output = tempFile.replace(/\.\w+$/, '.webp');
            ffmpeg(tempFile)
                .outputOptions(['-vcodec', 'libwebp', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15'])
                .save(output)
                .on('end', async () => {
                    const sticker = MessageMedia.fromFilePath(output);
                    await chat.sendMessage(sticker, { sendMediaAsSticker: true });
                    fs.unlinkSync(tempFile);
                    fs.unlinkSync(output);
                })
                .on('error', (err) => {
                    console.error(err);
                    chat.sendMessage('❌ Error creando sticker');
                    fs.unlinkSync(tempFile);
                });
        } else { // imagen normal
            const sticker = new MessageMedia(media.mimetype, media.data, media.filename);
            await chat.sendMessage(sticker, { sendMediaAsSticker: true });
            fs.unlinkSync(tempFile);
        }
    }
});

client.initialize();

// --------- SERVIDOR EXPRESS ---------
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Servidor activo!'));
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
