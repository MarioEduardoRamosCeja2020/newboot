const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express'); // Para mantener el servicio vivo en Render
const app = express();

const PORT = process.env.PORT || 3003; // Render asigna el puerto vía variable de entorno

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "default" }),
    puppeteer: { headless: true }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('🐐🇫🇷 ⚠️ Escanea el QR para iniciar sesión');
});

client.on('ready', async () => {
    console.log('🐐🇫🇷 🎉 Ya estoy listo para usarse, arriba las Chivas prrs!');

    // Aviso a todos los grupos activos
    const chats = await client.getChats();
    for (let chat of chats.filter(c => c.isGroup)) {
        chat.sendMessage('🐐🇫🇷 🎉 Ya estoy listo para usarse, arriba las Chivas prrs!');
    }
});

client.on('message', async msg => {
    const chat = await msg.getChat();

    // --------- MENÚ DE COMANDOS ---------
    if (msg.body.startsWith('.bot')) {
        const menu = `
🐐🇫🇷 *ChivasBot - Menú de Comandos* 🎉

*Comandos de utilidad:*
- .bot : Mostrar este menú
- .todos : Etiquetar a todos los miembros del grupo
- .notify <mensaje> : Enviar mensaje con mención a todos
- .hidetag <mensaje> : Enviar mensaje ocultando menciones

*Comandos divertidos:*
- .sticker : Crear sticker grande desde imagen o video
- .mesa4 <texto> : Crear mesa para 4 jugadores con mensaje
- .mesa6 <texto> : Crear mesa para 6 jugadores con mensaje

⚡ Usa los comandos y diviértete con tu grupo!
`;
        chat.sendMessage(menu);
    }

    // --------- ETIQUETAR A TODOS ---------
    if (msg.body.startsWith('.todos')) {
        if (!chat.isGroup) return;
        const mentions = chat.participants.map(p => p.id.user);
        const mentionText = mentions.map(u => `@${u}`).join(' ');
        chat.sendMessage(mentionText, { mentions: chat.participants.map(p => p.id) });
    }

    // --------- NOTIFY ---------
    if (msg.body.startsWith('.notify')) {
        if (!chat.isGroup) return;
        const text = msg.body.slice(8).trim();
        chat.sendMessage(text, { mentions: chat.participants.map(p => p.id) });
    }

    // --------- HIDETAG ---------
    if (msg.body.startsWith('.hidetag')) {
        if (!chat.isGroup) return;
        const text = msg.body.slice(8).trim();
        chat.sendMessage(text, { mentions: chat.participants.map(p => p.id), sendSeen: false });
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

    // --------- STICKERS GRANDES ---------
    if (msg.body.startsWith('.sticker')) {
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            try {
                const sticker = new MessageMedia(media.mimetype, media.data, 'sticker');
                chat.sendMessage(sticker, { sendMediaAsSticker: true, stickerName: 'ChivasBot', stickerAuthor: '🐐🇫🇷' });
            } catch (err) {
                console.log('❌ Error creando sticker:', err);
                chat.sendMessage('❌ Error creando sticker, asegúrate de enviar imagen o video compatible.');
            }
        } else {
            chat.sendMessage('📌 Por favor envía una imagen o video con el comando .sticker');
        }
    }
});

client.initialize();

// --------- EXPRESS SERVER PARA RENDER ---------
app.get('/', (req, res) => {
    res.send('🐐🇫🇷 ChivasBot está activo!');
});

app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
