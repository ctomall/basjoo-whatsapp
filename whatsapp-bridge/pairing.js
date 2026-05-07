
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'session');
fs.mkdirSync(SESSION_DIR, { recursive: true });

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })) },
    browser: ['Basjoo AI', 'Chrome', '1.0.0'],
    printQRInTerminal: false,  // Don't print QR
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, qr }) => {
    if (qr) {
      console.log('QR_AVAILABLE');
    }
    if (connection === 'open') {
      console.log('CONNECTED');
      console.log('USER:' + sock.user?.id);
      process.exit(0);
    }
    if (connection === 'close') {
      console.log('DISCONNECTED');
      process.exit(1);
    }
  });

  // Request pairing code
  try {
    // Use the phone number for pairing
    const phoneNumber = process.env.WA_PHONE || '';
    if (phoneNumber) {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('PAIRING_CODE:' + code);
    } else {
      // Without phone number, try QR
      console.log('NO_PHONE - falling back to QR');
      // Wait for QR
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) {
    console.log('PAIRING_ERROR:' + e.message);
  }
  
  // Keep alive
  await new Promise(r => setTimeout(r, 25000));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
