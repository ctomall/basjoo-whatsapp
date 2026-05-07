/**
 * Basjoo WhatsApp Bridge
 * Baileys protocol → Basjoo Chat API
 * 
 * Usage:
 *   npm install && node bridge.js
 *   Scan QR code with WhatsApp mobile app
 */

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const express = require('express');
const P = require('pino');
const fs = require('fs');
const path = require('path');

// ============ Configuration ============
const BASJOO_API = process.env.BASJOO_API_URL || 'http://127.0.0.1:8000';
const BASJOO_AGENT_ID = process.env.BASJOO_AGENT_ID || 'agt_8fb848968c5a';
const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '3001');
const SESSION_DIR = process.env.SESSION_DIR || path.join(__dirname, 'session');

// ============ Session Store ============
const messageQueue = [];
const sessions = new Map(); // visitor_id → session_id mapping

// ============ Basjoo Chat API ============
async function basjooChat(visitorId, message) {
  const sessionId = sessions.get(visitorId) || null;

  const body = {
    agent_id: BASJOO_AGENT_ID,
    message: message,
    visitor_id: visitorId,
  };
  if (sessionId) body.session_id = sessionId;

  try {
    const res = await fetch(`${BASJOO_API}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Basjoo API error ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // Store session for continuity
    if (data.session_id) {
      sessions.set(visitorId, data.session_id);
    }

    return data.reply || '(no reply)';
  } catch (err) {
    console.error(`[Basjoo] Chat error for ${visitorId}:`, err.message);
    return `Sorry, I'm having trouble right now. Please try again later.\n\n系统暂时出现故障，请稍后再试。`;
  }
}

// ============ WhatsApp Connection ============
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'warn' })),
    },
    printQRInTerminal: true,
    browser: ['Basjoo AI', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
      console.log(`   Bridge: http://localhost:${BRIDGE_PORT}`);
      console.log(`   Basjoo API: ${BASJOO_API}`);
      console.log(`   Agent: ${BASJOO_AGENT_ID}\n`);
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom &&
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log(
        'WhatsApp disconnected:',
        lastDisconnect?.error?.message || 'unknown',
        shouldReconnect ? '(reconnecting...)' : '(logged out)'
      );

      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000);
      }
    }
  });

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue; // Skip own messages

      const senderId = msg.key.remoteJid;
      const messageText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      if (!messageText) continue;
      if (senderId.includes('@g.us') && !msg.message?.extendedTextMessage?.text?.includes('@' + sock.user?.id?.split(':')[0])) {
        // Group message not mentioning us - skip (optional)
      }

      const visitorId = senderId.replace(/[^a-zA-Z0-9]/g, '_');
      const displayName = senderId.includes('@s.whatsapp.net')
        ? senderId.split('@')[0]
        : senderId;

      console.log(`📩 [${displayName}]: ${messageText.substring(0, 100)}`);

      // Show typing indicator
      await sock.sendPresenceUpdate('composing', senderId);

      const reply = await basjooChat(visitorId, messageText);

      // Stop typing
      await sock.sendPresenceUpdate('paused', senderId);

      // Send reply
      await sock.sendMessage(senderId, { text: reply });
      console.log(`📤 [${displayName}]: ${reply.substring(0, 100)}`);

      // Queue for HTTP polling
      messageQueue.push({
        id: msg.key.id,
        from: senderId,
        visitor_id: visitorId,
        body: messageText,
        reply: reply,
        timestamp: new Date().toISOString(),
      });

      // Keep queue size manageable
      if (messageQueue.length > 1000) messageQueue.shift();
    }
  });

  return sock;
}

// ============ HTTP Bridge (for monitoring/debug) ============
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', messages_queued: messageQueue.length });
});

app.get('/messages', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const newMessages = messageQueue.slice(since);
  res.json({ messages: newMessages, total: messageQueue.length });
});

app.post('/send', async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) {
    return res.status(400).json({ error: 'Missing "to" or "text"' });
  }
  try {
    const sock = globalThis.__sock;
    if (!sock) throw new Error('WhatsApp not connected');
    await sock.sendMessage(to, { text });
    res.json({ status: 'sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Startup ============
async function main() {
  console.log('🚀 Starting Basjoo WhatsApp Bridge...\n');

  // Start HTTP server first
  app.listen(BRIDGE_PORT, () => {
    console.log(`🌉 HTTP bridge listening on port ${BRIDGE_PORT}`);
  });

  // Start WhatsApp connection
  const sock = await startWhatsApp();
  globalThis.__sock = sock;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
