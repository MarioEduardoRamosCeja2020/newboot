import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import express from 'express';
import mysql from 'mysql2/promise';

const { Client, LocalAuth } = pkg;

const PORT = process.env.PORT || 10000;

// 1️⃣ Conexión a MySQL (usando las variables de entorno en Render)
const db = await mysql.createConnection({
  host: process.env.DB_HOST,      // Asegúrate de poner la URL del host remoto
  user: process.env.DB_USER,      // Tu usuario de la base de datos
  password: process.env.DB_PASS,  // Tu contraseña de la base de datos
  database: process.env.DB_NAME,  // El nombre de la base de datos
  port: process.env.DB_PORT || 3306, // El puerto (si no es el predeterminado, puedes configurarlo)
});

// 2️⃣ Crear la base de datos 'whatsappbot' si no existe
await db.execute(`
  CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME};
`);

// 3️⃣ Crear la tabla 'whatsapp_sessions' si no existe
await db.execute(`
  CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id VARCHAR(50) PRIMARY KEY,
    data TEXT
  );
`);

// 🟢 Implementación personalizada de almacenamiento de sesión en MySQL
class MySQLAuthStore {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
  }

  async get(key) {
    const [rows] = await db.execute('SELECT data FROM whatsapp_sessions WHERE id = ?', [this.sessionId]);
    if (rows.length === 0) return null;
    const data = JSON.parse(rows[0].data);
    return data[key] || null;
  }

  async set(key, value) {
    const [rows] = await db.execute('SELECT data FROM whatsapp_sessions WHERE id = ?', [this.sessionId]);
    let data = {};
    if (rows.length > 0) {
      data = JSON.parse(rows[0].data);
    }
    data[key] = value;
    await db.execute('REPLACE INTO whatsapp_sessions (id, data) VALUES (?, ?)', [this.sessionId, JSON.stringify(data)]);
  }

  async remove(key) {
    const [rows] = await db.execute('SELECT data FROM whatsapp_sessions WHERE id = ?', [this.sessionId]);
    if (rows.length === 0) return;
    const data = JSON.parse(rows[0].data);
    delete data[key];
    await db.execute('REPLACE INTO whatsapp_sessions (id, data) VALUES (?, ?)', [this.sessionId, JSON.stringify(data)]);
  }
}

// 🟢 Cliente WhatsApp usando MySQL como AuthStore
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'bot',
    dataPath: './', // Utiliza el directorio actual para almacenar temporalmente los datos.
    store: new MySQLAuthStore('bot_session')
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

// 🟢 Eventos del cliente
client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('Escanea este QR para iniciar sesión');
});

client.on('ready', () => {
  console.log('Bot conectado con sesión guardada en MySQL ✅');
});

// 🟢 Inicializar el cliente de WhatsApp
client.initialize();

// 🟢 Servidor Express para mantener el bot activo
const app = express();
app.get('/', (req, res) => res.send('Bot activo y corriendo'));
app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
