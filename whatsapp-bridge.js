#!/usr/bin/env node
/**
 * Basjoo WhatsApp 桥接服务
 * 
 * 功能：
 * - 扫码登录 WhatsApp Web（跟桌面版 WhatsApp Web 一样）
 * - 自动接收客户消息
 * - 调 Basjoo API 获取 AI 回复
 * - 自动发送回复到 WhatsApp
 * 
 * 使用：
 * 1. npm install whatsapp-web.js qrcode-terminal axios
 * 2. node whatsapp-bridge.js
 * 3. 终端出现 QR 码 → 手机 WhatsApp 扫码 → 开始工作
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');

// ============ 配置 ============
const CONFIG = {
  // Basjoo API 地址（修改为你的 Basjoo 部署地址）
  basjooUrl: process.env.BASJOO_URL || 'http://localhost:8000',
  basjooAgentId: process.env.BASJOO_AGENT_ID || 'default',
  
  // 自动回复设置
  autoReply: true,           // 是否自动回复
  replyDelay: 2000,          // 回复延迟（毫秒），避免被 WhatsApp 限速
  
  // 工作时间（可选，设为 null 则 24 小时）
  workHours: null,           // { start: 8, end: 22 }  或 null
  
  // 排除自己的号（不回复自己）
  myNumber: process.env.MY_WHATSAPP || '',  // 格式: '8613616353377@c.us'
};

// ============ Basjoo AI 调用 ============
// 会话缓存：记录每个客户的上轮 session_id
const sessions = new Map();

async function askBasjoo(message, phoneNumber) {
  try {
    const sessionId = sessions.get(phoneNumber);
    
    const response = await axios.post(`${CONFIG.basjooUrl}/api/v1/chat`, {
      agent_id: CONFIG.basjooAgentId,
      message: message,
      visitor_id: phoneNumber,
      session_id: sessionId || undefined,
      locale: 'auto',  // Basjoo 自动检测语言
    }, {
      timeout: 30000
    });
    
    const { reply, session_id } = response.data;
    
    // 保存会话 ID 用于多轮对话
    if (session_id) {
      sessions.set(phoneNumber, session_id);
    }
    
    return reply || '抱歉，当前无法处理您的请求，请稍后再试。';
  } catch (error) {
    console.error(`[Basjoo API] ${error.message}`);
    return '抱歉，服务暂时不可用。请 WhatsApp +86 13616353377 直接联系。';
  }
}

// ============ WhatsApp 客户端 ============
console.log('🤖 Basjoo WhatsApp 桥接服务启动中...');
console.log(`   Basjoo API: ${CONFIG.basjooUrl}`);
console.log(`   Agent ID: ${CONFIG.basjooAgentId}`);

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './whatsapp-session'  // 保存登录状态，下次无需重新扫码
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// QR 码事件
client.on('qr', (qr) => {
  // 用 qrcode-terminal 在终端显示 QR 码
  try {
    const qrcode = require('qrcode-terminal');
    qrcode.generate(qr, { small: true });
  } catch (e) {
    // 如果没有 qrcode-terminal，输出原始 QR 文本
    console.log('\n📱 请用手机 WhatsApp 扫描下方 QR 码登录：');
    console.log('（安装 qrcode-terminal 可看到图形化 QR 码: npm install qrcode-terminal）\n');
  }
  
  console.log('\n⚠️  QR 码有效时间 20 秒，请尽快扫描');
  console.log('   如果过期，重启服务即可生成新 QR 码\n');
});

// 登录成功
client.on('ready', () => {
  console.log('✅ WhatsApp 已连接！自动回复已启用');
  console.log('   接收客户消息中...\n');
});

// 认证状态
client.on('authenticated', () => {
  console.log('🔐 认证成功，session 已保存');
});

// 认证失败
client.on('auth_failure', (msg) => {
  console.error('❌ 认证失败:', msg);
});

// 断开连接
client.on('disconnected', (reason) => {
  console.log('⚠️  WhatsApp 断开连接:', reason);
  console.log('   请删除 whatsapp-session 文件夹后重启');
});

// ============ 消息处理 ============
client.on('message', async (message) => {
  // 跳过状态消息和群组消息
  if (message.isStatus) return;
  if (!message.from.endsWith('@c.us')) return;  // 只处理个人消息
  if (message.from === CONFIG.myNumber) return;   // 不回复自己
  
  const phone = message.from.replace('@c.us', '');
  const text = message.body;
  
  console.log(`\n📩 [${new Date().toLocaleTimeString()}] ${phone}: ${text.substring(0, 80)}`);
  
  if (!CONFIG.autoReply) {
    console.log('   (自动回复已关闭)');
    return;
  }
  
  // 工作时间检查
  if (CONFIG.workHours) {
    const hour = new Date().getHours();
    if (hour < CONFIG.workHours.start || hour >= CONFIG.workHours.end) {
      console.log(`   (非工作时间 ${hour}:00，将在 ${CONFIG.workHours.start}:00 后回复)`);
      return;
    }
  }
  
  // 获取 AI 回复
  const reply = await askBasjoo(text, phone);
  
  // 发送回复
  await new Promise(r => setTimeout(r, CONFIG.replyDelay));
  await message.reply(reply);
  
  console.log(`📤 回复: ${reply.substring(0, 80)}`);
});

// 启动
client.initialize();

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n🛑 关闭服务...');
  await client.destroy();
  process.exit(0);
});

console.log('等待 WhatsApp 扫码...');
