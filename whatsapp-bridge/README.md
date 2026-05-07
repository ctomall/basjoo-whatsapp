# Basjoo WhatsApp Bridge

基于 [Baileys](https://github.com/WhiskeySockets/Baileys) 协议的 WhatsApp → Basjoo AI 客服桥接。

```
WhatsApp 客户消息
    │
    ▼
Baileys (WebSocket 协议直连, 无浏览器)
    │
    ▼
bridge.js (Express HTTP Server :3001)
    │  POST /api/v1/chat
    ▼
Basjoo FastAPI Backend (:8000)
    │  RAG 检索 + LLM 推理
    ▼
AI 回复 → bridge.js → Baileys → WhatsApp 客户
```

## 快速开始

### 1. 安装依赖

```bash
cd whatsapp-bridge
npm install
```

### 2. 配置环境变量

```bash
export BASJOO_API_URL=http://127.0.0.1:8000     # Basjoo 后端地址
export BASJOO_AGENT_ID=agt_8fb848968c5a          # Agent ID
export BRIDGE_PORT=3001                           # 桥接 HTTP 端口
export SESSION_DIR=./session                      # WhatsApp 登录态存储
```

### 3. 启动

```bash
npm start
```

终端会显示 QR 码 → 用手机 WhatsApp 扫码（设置 → 已关联设备 → 关联设备）。

### 4. 验证

```bash
# 检查桥接状态
curl http://localhost:3001/health

# 查看最近消息
curl http://localhost:3001/messages

# 手动发送消息
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to":"8613616353377@s.whatsapp.net","text":"Hello from Basjoo!"}'
```

## 架构

### 协议层：Baileys

- WhatsApp Web 协议逆向，WebSocket 直连
- **不需要** Chrome/Puppeteer — 比 whatsapp-web.js 轻 10 倍
- E2EE 端到端加密自动处理（Signal Protocol）
- 扫码后 session 持久化到 `session/` 目录

### 桥接层：bridge.js

| API | 方法 | 说明 |
|-----|------|------|
| `/health` | GET | 健康检查 |
| `/messages` | GET | 查看最近消息队列 |
| `/send` | POST | 手动发送 WhatsApp 消息 |

### 消息流

每个 WhatsApp 用户映射为一个 `visitor_id`，Basjoo 的 `session_id` 自动管理多轮对话上下文。

## 依赖

| 包 | 用途 |
|----|------|
| @whiskeysockets/baileys | WhatsApp WebSocket 协议 |
| @hapi/boom | 错误处理 |
| express | HTTP API |
| pino | 日志 |
| qrcode-terminal | 终端 QR 码显示 |

## 注意事项

- 首次运行需扫码，后续自动登录
- session 目录包含加密密钥，**不要泄露**
- WhatsApp 可能要求手机保持在线
- 群聊消息默认不回复（避免骚扰）
