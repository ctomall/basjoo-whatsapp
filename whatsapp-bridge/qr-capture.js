
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

const SESSION_DIR = path.join(__dirname, 'session');
fs.mkdirSync(SESSION_DIR, { recursive: true });

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })) },
    browser: ['Basjoo AI', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, qr }) => {
    if (qr) {
      console.log('QR_RECEIVED');
      // Generate QR as PNG file
      const qrPath = path.join(__dirname, 'qr.png');
      await qrcode.toFile(qrPath, qr, { type: 'png', width: 400, margin: 2 });
      console.log('QR_SAVED:' + qrPath);
      
      // Also output to terminal
      qrcode.toString(qr, { type: 'terminal', small: true }, (err, str) => {
        if (!err) console.log(str);
      });
    }
    if (connection === 'open') {
      console.log('CONNECTED');
      process.exit(0);
    }
  });
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
