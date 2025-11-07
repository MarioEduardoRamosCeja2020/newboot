const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const prefix = '🐐🇫🇷';

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "chivabot" }),
    puppeteer: { headless: true }
});

// ====================== Inicio ======================
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log(`${prefix} 📸 Escanea este QR con WhatsApp Web`);
});

client.on('ready', () => {
    console.log(`${prefix} 🎉 Ya estoy listo para usarse, arriba las Chivas prrs!`);
});

// ====================== Comandos ======================
client.on('message', async msg => {
    const chat = await msg.getChat();
    const text = msg.body || '';
    
    try {
        // --------- Sticker gigante y animado ---------
        if (text.startsWith('.s')) {
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                const ext = media.mimetype.split('/')[1];
                const tempDir = path.join(__dirname, 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                const inputPath = path.join(tempDir, `input.${ext}`);
                const outputPath = path.join(tempDir, `sticker.webp`);
                fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));

                ffmpeg(inputPath)
                    .outputOptions([
                        '-vcodec libwebp',
                        '-vf "scale=720:720:force_original_aspect_ratio=decrease,fps=30"',
                        '-lossless 1',
                        '-compression_level 6',
                        '-qscale 75',
                        '-loop 0',
                        '-preset default'
                    ])
                    .toFormat('webp')
                    .save(outputPath)
                    .on('end', async () => {
                        const sticker = MessageMedia.fromFilePath(outputPath);
                        await chat.sendMessage(sticker, {
                            sendMediaAsSticker: true,
                            stickerName: 'ChivaBot',
                            stickerAuthor: '🐐🇫🇷'
                        });
                        fs.unlinkSync(inputPath);
                        fs.unlinkSync(outputPath);
                    })
                    .on('error', err => {
                        console.error(`${prefix} ❌ Error creando sticker:`, err);
                        msg.reply(`${prefix} ❌ Error creando sticker: ${err.message}`);
                    });

            } else {
                msg.reply(`${prefix} 📸 Envía una imagen, video o GIF con el comando .s para convertirlo en sticker gigante y animado.`);
            }
        }

        // --------- Abrir grupo ---------
        if (text.startsWith('.abrir')) {
            if (chat.isGroup) {
                await chat.setMessagesAdminsOnly(false);
                msg.reply(`${prefix} ✅ El grupo ha sido abierto para todos los participantes.`);
            } else {
                msg.reply(`${prefix} ❌ Este comando solo funciona en grupos.`);
            }
        }

        // --------- Cerrar grupo ---------
        if (text.startsWith('.cerrar')) {
            if (chat.isGroup) {
                await chat.setMessagesAdminsOnly(true);
                msg.reply(`${prefix} ✅ El grupo ha sido cerrado solo para administradores.`);
            } else {
                msg.reply(`${prefix} ❌ Este comando solo funciona en grupos.`);
            }
        }

        // --------- Menu de comandos ---------
        if (text.startsWith('.boy')) {
            msg.reply(`${prefix} 🤖 *Comandos de ChivaBot*:
            
.s + media → Sticker gigante/animado
.cerrar → Cerrar grupo solo admin
.abrir → Abrir grupo para todos
.boy → Mostrar este menú
            
Ejemplo: envía una imagen y responde con .s para convertirla en sticker gigante.`);
        }

    } catch (error) {
        console.error(`${prefix} ⚠️ Error al procesar mensaje:`, error);
        msg.reply(`${prefix} ⚠️ Ocurrió un error: ${error.message}`);
    }
});

// ====================== Cliente ======================
client.initialize();
