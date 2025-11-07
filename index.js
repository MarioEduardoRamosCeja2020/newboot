import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

// Render asigna puerto automáticamente
const PORT = process.env.PORT || 10000;

// Usamos LocalAuth para guardar la sesión en /root/.wwebjs_auth (Render)
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'bot' }),
    puppeteer: { headless: true }
});

// QR code para la primera conexión
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('🐐🇫🇷 ⚠️ Escanea este QR para iniciar sesión');
});

// Evento ready: sesión guardada y bot activo
client.on('ready', async () => {
    console.log(`🐐🇫🇷 🎉 Bot activo en Render en puerto ${PORT}!`);

    // Avisar a todos los grupos que el bot está listo
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    for (const group of groups) {
        await group.sendMessage('🐐🇫🇷 🎉 ¡Bot activo y listo para usarse! Usa .bot para ver el menú de comandos.');
    }
});

// Manejo de mensajes y comandos
client.on('message', async msg => {
    const chat = await msg.getChat();
    const args = msg.body.split(' ');
    const command = args[0].toLowerCase();
    const text = args.slice(1).join(' ');

    try {
        // ---- Menú de comandos ----
        if(command === '.bot'){
            let menu = `🐐🇫🇷 *Menú de comandos*\n\n`;
            menu += `.bot - Mostrar este menú\n`;
            menu += `.todos - Etiquetar a todos\n`;
            menu += `.hidetag <mensaje> - Mensaje ocultando menciones\n`;
            menu += `.notify <mensaje> - Notificar a todos\n`;
            menu += `.mesa4/.mesa6 <mensaje> - Crear mesa de 4 o 6 jugadores\n`;
            menu += `.sticker <imagen/video> - Crear sticker\n`;
            await chat.sendMessage(menu);
        }

        // ---- Etiquetar a todos ----
        if(command === '.todos' && chat.isGroup){
            const mentions = chat.participants.map(p => p.id._serialized);
            const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
            await chat.sendMessage(`${mentionText} ${text}`, { mentions });
        }

        // ---- Hidetag ----
        if(command === '.hidetag' && chat.isGroup){
            const mentions = chat.participants.map(p => p.id._serialized);
            await chat.sendMessage(text, { mentions });
        }

        // ---- Notify ----
        if(command === '.notify' && chat.isGroup){
            const mentions = chat.participants.map(p => p.id._serialized);
            const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
            await chat.sendMessage(`${mentionText} ${text}`, { mentions });
        }

        // ---- Juego de mesa ----
        if((command === '.mesa4' || command === '.mesa6') && chat.isGroup){
            const players = command === '.mesa4' ? 4 : 6;
            const shuffled = chat.participants.sort(() => 0.5 - Math.random()).slice(0, players);
            const mentions = shuffled.map(p => p.id._serialized);
            const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
            await chat.sendMessage(`Mesa de ${players}: ${mentionText}\n${text}`, { mentions });
        }

        // ---- Sticker ----
        if(command === '.sticker'){
            if(msg.hasMedia){
                const media = await msg.downloadMedia();
                await chat.sendMessage(media, { sendMediaAsSticker: true });
            } else {
                await chat.sendMessage('❌ Envía una imagen o video para crear sticker.');
            }
        }

    } catch (err) {
        console.error('Error procesando mensaje:', err);
        await chat.sendMessage('⚠️ Ocurrió un error, revisa el comando e intenta de nuevo.');
    }
});

// Inicializar bot
client.initialize();
