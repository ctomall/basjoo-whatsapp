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
    printQRInTerminal: false,
    qrTimeout: 60000,  // 60 second QR timeout
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    const now = new Date().toISOString();
    
    if (qr) {
      const qrPath = path.join(__dirname, 'qr.png');
      await qrcode.toFile(qrPath, qr, { type: 'png', width: 400, margin: 2 });
      fs.writeFileSync(path.join(__dirname, 'qr_ready'), now);
      console.log(`[${now}] QR_READY -> qr.png`);
    }
    
    if (connection === 'open') {
      console.log(`[${now}] CONNECTED! WhatsApp logged in.`);
      fs.writeFileSync(path.join(__dirname, 'connected'), now);
      process.exit(0);
    }
    
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`[${now}] DISCONNECTED (reason: ${reason || 'unknown'})`);
      // Remove stale QR
      try { fs.unlinkSync(path.join(__dirname, 'qr_ready')); } catch(e) {}
      
      if (reason === 401) {
        // Logged out - clear session
        console.log('Logged out, clearing session...');
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      }
    }
  });
}

main().catch(e => { 
  console.error('FATAL:', e.message);
  process.exit(1);
});
