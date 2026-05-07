# Basjoo + WhatsApp Bridge

AI 客服系统 Basjoo，集成 WhatsApp 通道（Baileys 协议）。

```
┌──────────────────────────────────────────────────┐
│                   客户触点                         │
│  WhatsApp │ 网站 Widget │ 其他渠道 (可扩展)        │
└──────────────┬───────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────┐
│           Basjoo FastAPI Backend (:8000)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Chat API │ │ RAG 检索 │ │ Agent 管理       │  │
│  │ (SSE流式)│ │ (Qdrant) │ │ (多Provider)     │  │
│  └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │           Next.js Admin Dashboard          │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────┐
│         WhatsApp Bridge (Baileys) (:3001)         │
│  收到消息 → POST /api/v1/chat → AI回复 → 发回     │
└──────────────────────────────────────────────────┘
```

## 系统要求

- Linux (Ubuntu/Debian 推荐)
- Python 3.10+
- Node.js 18+
- 可选：Docker（生产部署推荐）

## 快速开始

### 一键启动

```bash
chmod +x start.sh
./start.sh
```

这会依次启动 Qdrant、Basjoo 后端、WhatsApp 桥接。

### 分步启动

#### 1. 启动 Qdrant 向量数据库

```bash
# 下载 Qdrant 二进制 (v1.12.1)
curl -sL "https://github.com/qdrant/qdrant/releases/download/v1.12.1/qdrant-x86_64-unknown-linux-gnu.tar.gz" -o /tmp/qdrant.tar.gz
tar xzf /tmp/qdrant.tar.gz -C /tmp/

# 启动
mkdir -p qdrant_storage
/tmp/qdrant --storage-path ./qdrant_storage --uri "http://127.0.0.1:6333" &

# 验证
curl http://127.0.0.1:6333/health
```

#### 2. 配置并启动 Basjoo 后端

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 配置 .env
cp .env.example .env
# 编辑 .env，设置你的 API Key

# 创建数据目录
mkdir -p data

# 启动
python3 main.py

# 验证
curl http://127.0.0.1:8000/health
```

#### 3. 启动 WhatsApp 桥接

```bash
cd whatsapp-bridge
npm install
npm start
# 终端显示 QR 码 → 手机 WhatsApp 扫码
```

## 环境变量

### Basjoo Backend (backend/.env)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | 数据库连接 | sqlite:///./data/basjoo.db |
| QDRANT_HOST | Qdrant 地址 | 127.0.0.1 |
| QDRANT_PORT | Qdrant 端口 | 6333 |
| OPENAI_API_KEY | OpenAI API Key | - |
| DEEPSEEK_API_KEY | DeepSeek API Key | - |
| DEFAULT_AGENT_ID_FILE | Agent ID 持久化文件 | /app/data/.agent_id |
| SECRET_KEY_FILE | JWT 密钥文件 | /app/data/.secret_key |
| APP_PORT | 服务端口 | 8000 |
| LOG_LEVEL | 日志级别 | INFO |

### WhatsApp Bridge

| 变量 | 说明 | 默认值 |
|------|------|--------|
| BASJOO_API_URL | Basjoo API 地址 | http://127.0.0.1:8000 |
| BASJOO_AGENT_ID | Agent ID | agt_8fb848968c5a |
| BRIDGE_PORT | 桥接端口 | 3001 |
| SESSION_DIR | WhatsApp 登录态目录 | ./session |

## 项目结构

```
basjoo/
├── backend/              # FastAPI 后端
│   ├── api/v1/           # API 路由
│   ├── services/         # 服务层 (RAG, LLM, 爬虫)
│   ├── models.py         # 数据模型
│   ├── config.py         # 配置
│   ├── main.py           # 入口
│   └── .env              # 环境变量
├── whatsapp-bridge/      # WhatsApp 桥接
│   ├── bridge.js         # 桥接主程序
│   ├── package.json
│   └── session/          # WhatsApp 登录态 (gitignore)
├── qdrant_storage/       # 向量数据库存储 (gitignore)
├── data/                 # SQLite + 密钥 (gitignore)
├── start.sh              # 一键启动脚本
└── README.md             # 本文件
```

## 技术支持

- Basjoo 官方仓库: https://github.com/haoyiyin/basjoo
- Baileys 协议库: https://github.com/WhiskeySockets/Baileys
- 供应商: OpenAI / DeepSeek / Anthropic / Google Gemini

## 本地开发修改

相比上游 Basjoo，本项目做了以下修改：

1. `config.py`: `DEFAULT_AGENT_ID_FILE` 支持环境变量覆盖（默认 `/app/data/` → 可配置）
2. `main.py`: uvicorn `log_level` 转为小写（兼容性修复）
3. `config.py`: 添加 `import os`
